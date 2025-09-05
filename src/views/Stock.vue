<template>
  <v-container fluid class="pa-md-6 pa-4">
    <v-toolbar color="transparent" class="mb-6">
      <v-toolbar-title class="font-weight-bold text-h5">
        <v-icon start size="32">mdi-warehouse</v-icon>
        Estoque de Tecidos
      </v-toolbar-title>
      <v-spacer></v-spacer>
      <v-text-field
        v-model="search"
        variant="solo-filled"
        flat
        density="compact"
        label="Buscar tecido..."
        prepend-inner-icon="mdi-magnify"
        hide-details
        style="max-width: 300px;"
      ></v-text-field>
    </v-toolbar>

    <div v-if="loading" class="text-center py-16">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        <p class="mt-4 text-grey-lighten-1">Sincronizando com o Gestão Click...</p>
    </div>

    <v-alert v-else-if="filteredStockItems.length === 0" type="info" variant="tonal" class="mx-auto" max-width="500">
      Nenhum item encontrado no estoque com o termo "{{ search }}".
    </v-alert>

    <v-row v-else>
      <v-col
        v-for="item in filteredStockItems"
        :key="item.id"
        cols="12"
        sm="6"
        md="4"
        lg="3"
      >
        <v-card class="stock-item-card" variant="flat">
          <v-card-text>
            <div class="d-flex align-center">
              <div>
                <h3 class="text-h6 font-weight-bold">{{ item.nome }}</h3>
                <p class="text-caption text-medium-emphasis mt-1">Disponível em estoque</p>
              </div>
              <v-spacer></v-spacer>
              <div class="text-right">
                <div v-if="item.meters_per_roll" class="d-flex align-center justify-end mb-1 text-grey-lighten-1">
                  <v-icon size="small" class="mr-1">mdi-tape-measure</v-icon>
                  <span class="text-caption font-weight-bold">{{ item.meters_per_roll }}m / Rolo</span>
                </div>
                <p class="text-h4 font-weight-bold" :class="getMeterColor(item.estoque)">
                  {{ item.estoque.toLocaleString('pt-BR') }}{{ item.unit_of_measure === 'kg' ? 'kg' : 'm' }}
                </p>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { supabase } from '@/api/supabase';
import { gestaoApi } from '@/api/gestaoClick';

// Tipagem para os dados que vêm do Gestão Click
type GestaoClickStockItem = {
  id: string;
  nome: string;
  estoque: number;
  [key: string]: any;
};

// Tipagem para os dados que vêm do Supabase (o nosso "cérebro")
type SupabaseStockInfo = {
  fabric_type: string;
  unit_of_measure: 'metro' | 'kg';
  meters_per_roll: number | null;
};

// Tipagem para o item combinado final
type CombinedStockItem = GestaoClickStockItem & SupabaseStockInfo;

const loading = ref(true);
const search = ref('');
const gestaoClickItems = ref<GestaoClickStockItem[]>([]);
const supabaseStockItems = ref<SupabaseStockInfo[]>([]);

// Propriedade computada que faz a mágica de juntar as duas fontes de dados
const combinedStockItems = computed((): CombinedStockItem[] => {
    return gestaoClickItems.value.map(gcItem => {
        // Para cada item do Gestão Click, ele procura a configuração correspondente no Supabase
        const sbItem = supabaseStockItems.value.find(sb => sb.fabric_type === gcItem.nome);
        return {
            ...gcItem,
            // Pega a unidade do Supabase. Se não achar, assume 'metro' como padrão.
            unit_of_measure: sbItem?.unit_of_measure || 'metro',
            meters_per_roll: sbItem?.meters_per_roll || null,
            fabric_type: gcItem.nome
        };
    });
});

const filteredStockItems = computed(() => {
  if (!search.value) {
    return combinedStockItems.value.sort((a, b) => a.nome.localeCompare(b.nome));
  }
  return combinedStockItems.value.filter(item =>
    item.nome.toLowerCase().includes(search.value.toLowerCase())
  ).sort((a, b) => a.nome.localeCompare(b.nome));
});

const getMeterColor = (meters: number): string => {
  if (meters < 0) return 'text-error';
  if (meters < 100) return 'text-warning';
  return 'text-success';
}

// Função que busca os dados dos dois lugares
const fetchStock = async () => {
  loading.value = true;
  try {
    const [gcData, sbData] = await Promise.all([
        gestaoApi.buscarProdutos(),
        supabase.from('stock').select('fabric_type, unit_of_measure, meters_per_roll')
    ]);

    gestaoClickItems.value = gcData || [];
    if (sbData.error) throw sbData.error;
    supabaseStockItems.value = sbData.data || [];

  } catch (err: any) {
    console.error(`Erro ao buscar e combinar estoques: ${err.message}`);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchStock);
</script>

<style scoped lang="scss">
.stock-item-card {
  border-radius: 12px;
  background-color: rgba(30, 30, 35, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease-in-out;
  overflow: hidden;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    border-color: rgba(var(--v-theme-primary), 0.5);
  }
}
</style>
