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
        <p class="mt-4 text-grey-lighten-1">Carregando estoque...</p>
    </div>

    <v-alert v-else-if="filteredStockItems.length === 0" type="info" variant="tonal" class="mx-auto" max-width="500">
      Nenhum item encontrado com o termo "{{ search }}".
    </v-alert>

    <v-row v-else>
      <v-col v-for="item in filteredStockItems" :key="item.id" cols="12" sm="6" md="4" lg="3">
        <v-card class="stock-item-card" variant="flat">
          <v-card-text>
            <div class="d-flex align-center">
              <div>
                <h3 class="text-h6 font-weight-bold">{{ item.name }}</h3>
                <p class="text-caption text-medium-emphasis mt-1">Disponível em estoque</p>
              </div>
              <v-spacer></v-spacer>
              <div class="text-right">
                <p class="text-h4 font-weight-bold" :class="getStockColor(item.current_stock)">
                  {{ item.current_stock.toLocaleString('pt-BR') }}{{ item.unit_of_measure === 'kg' ? 'kg' : 'm' }}
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

type Product = {
  id: string;
  name: string;
  current_stock: number;
  unit_of_measure: 'metro' | 'kg';
  rendimento: number | null;
};

const loading = ref(true);
const search = ref('');
const stockItems = ref<Product[]>([]);

const filteredStockItems = computed(() => {
  if (!search.value) {
    return stockItems.value;
  }
  return stockItems.value.filter(item =>
    item.name.toLowerCase().includes(search.value.toLowerCase())
  );
});

const getStockColor = (stock: number): string => {
  if (stock <= 0) return 'text-error';
  if (stock < 100) return 'text-warning';
  return 'text-success';
}

const fetchStock = async () => {
  loading.value = true;
  try {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) throw error;
    stockItems.value = data || [];
  } catch (err: any) {
    console.error(`Erro ao buscar estoque: ${err.message}`);
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
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    border-color: rgba(var(--v-theme-primary), 0.5);
  }
}
</style>
