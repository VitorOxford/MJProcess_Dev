import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface GestaoClickProduct {
  id: string;
  nome: string;
  estoque: string; // Vem como string da API
}

const API_BASE_URL = 'https://mjprocess-proxy.onrender.com/api';

async function fetchProductsFromGestaoClick(): Promise<GestaoClickProduct[]> {
  const response = await fetch(`${API_BASE_URL}/produtos`);
  if (!response.ok) throw new Error(`Falha na requisição de produtos: ${response.statusText}`);
  const responseData = await response.json();
  if (responseData.status !== 'success') throw new Error('Erro ao buscar produtos da API externa.');
  return (responseData.data || []).filter((p: any) => p.movimenta_estoque === '1');
}

serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 1. Busca todos os produtos do Gestão Click
    const gestaoProducts = await fetchProductsFromGestaoClick();
    if (gestaoProducts.length === 0) throw new Error("Nenhum produto encontrado no Gestão Click.");

    // 2. Prepara os dados para o upsert
    const productsToSync = gestaoProducts.map(p => ({
      gestao_click_id: p.id,
      name: p.nome,
      current_stock: parseFloat(p.estoque) || 0,
      last_synced_at: new Date().toISOString()
    }));

    // 3. Executa o upsert no Supabase
    // Isso irá inserir novos produtos e atualizar o nome/estoque dos existentes,
    // sem sobrescrever as colunas 'unit_of_measure' e 'rendimento' que você definiu.
    const { data, error } = await supabaseAdmin
      .from('products')
      .upsert(productsToSync, { onConflict: 'gestao_click_id' });

    if (error) throw error;

    return new Response(
      JSON.stringify({ message: `Sincronização concluída! ${productsToSync.length} produtos do Gestão Click foram processados.` }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
