<template>
  <v-container>
    <v-card class="glassmorphism-card-stock">
      <v-toolbar color="transparent">
        <v-toolbar-title class="font-weight-bold">Gerenciar Produtos e Estoque</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="syncProducts" :loading="isSyncing">
          <v-icon start>mdi-sync</v-icon>
          Sincronizar com Gestão Click
        </v-btn>
      </v-toolbar>

      <v-data-table
        :headers="headers"
        :items="products"
        :loading="loading"
        class="elevation-0 bg-transparent"
        item-value="id"
      >
        <template v-slot:item.current_stock="{ item }">
          <v-chip :color="item.current_stock > 0 ? 'success' : 'error'" variant="tonal" size="small">
            {{ item.current_stock.toLocaleString('pt-BR') }}
          </v-chip>
        </template>
        <template v-slot:item.unit_of_measure="{ item }">
          <v-select
            v-model="item.unit_of_measure"
            :items="['metro', 'kg']"
            density="compact"
            hide-details
            variant="outlined"
            @update:modelValue="saveChanges(item)"
            style="max-width: 120px;"
          ></v-select>
        </template>
        <template v-slot:item.rendimento="{ item }">
          <v-text-field
            v-if="item.unit_of_measure === 'kg'"
            v-model.number="item.rendimento"
            type="number"
            density="compact"
            hide-details
            variant="outlined"
            suffix="m/kg"
            @blur="saveChanges(item)"
            style="max-width: 130px;"
          ></v-text-field>
          <span v-else class="text-grey">-</span>
        </template>
      </v-data-table>
    </v-card>
     <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
        {{ snackbar.text }}
      </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { supabase } from '@/api/supabase';

type Product = {
  id: string;
  name: string;
  current_stock: number;
  unit_of_measure: 'metro' | 'kg';
  rendimento: number | null;
};

const products = ref<Product[]>([]);
const loading = ref(true);
const isSyncing = ref(false);
const snackbar = reactive({ show: false, text: '', color: '' });

const headers = [
  { title: 'Produto (Gestão Click)', key: 'name', sortable: true },
  { title: 'Estoque Atual', key: 'current_stock' },
  { title: 'Unidade de Medida', key: 'unit_of_measure' },
  { title: 'Rendimento (se KG)', key: 'rendimento' },
];

const fetchProducts = async () => {
  loading.value = true;
  try {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) throw error;
    products.value = data || [];
  } catch (err: any) {
    showSnackbar(`Erro ao buscar produtos: ${err.message}`, 'error');
  } finally {
    loading.value = false;
  }
};

const saveChanges = async (item: Product) => {
  try {
    const payload = {
      unit_of_measure: item.unit_of_measure,
      // Garante que o rendimento seja nulo se a unidade não for kg
      rendimento: item.unit_of_measure === 'kg' ? item.rendimento : null
    };
    const { error } = await supabase.from('products').update(payload).eq('id', item.id);
    if (error) throw error;
    showSnackbar(`'${item.name}' atualizado com sucesso!`, 'success');
  } catch (err: any) {
    showSnackbar(`Erro ao salvar '${item.name}': ${err.message}`, 'error');
    await fetchProducts(); // Recarrega para reverter a alteração visual
  }
};

const syncProducts = async () => {
  isSyncing.value = true;
  try {
    const { data, error } = await supabase.functions.invoke('sync-units-from-gestao');
    if (error) throw error;
    showSnackbar(data.message || 'Sincronização concluída!', 'success');
    await fetchProducts();
  } catch (err: any) {
    showSnackbar(`Erro na sincronização: ${err.message}`, 'error');
  } finally {
    isSyncing.value = false;
  }
};

const showSnackbar = (text: string, color: string) => {
  snackbar.text = text;
  snackbar.color = color;
  snackbar.show = true;
};

onMounted(fetchProducts);
</script>

<style scoped lang="scss">
.glassmorphism-card-stock {
  backdrop-filter: blur(15px);
  background-color: rgba(25, 25, 30, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}
</style>
