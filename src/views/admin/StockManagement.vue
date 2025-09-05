<template>
  <v-container>
    <v-card class="glassmorphism-card-stock">
      <v-toolbar color="transparent">
        <v-toolbar-title class="font-weight-bold">Configurar Tecidos (Unidade e Rendimento)</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openDialog()">
          <v-icon start>mdi-plus</v-icon>
          Configurar Tecido
        </v-btn>
      </v-toolbar>

      <v-data-table
        :headers="headers"
        :items="stockItems"
        :loading="loading"
        class="elevation-0 bg-transparent"
        item-value="id"
      >
        <template v-slot:item.unit_of_measure="{ item }">
          <v-chip :color="item.unit_of_measure === 'kg' ? 'amber' : 'info'" variant="tonal" size="small">
            {{ item.unit_of_measure }}
          </v-chip>
        </template>
        <template v-slot:item.rendimento="{ item }">
          <span v-if="item.unit_of_measure === 'kg'">{{ item.rendimento || 'N/A' }} m/kg</span>
          <span v-else class="text-grey">-</span>
        </template>
        <template v-slot:item.actions="{ item }">
          <v-btn icon="mdi-pencil-outline" variant="text" size="small" @click="openDialog(item)"></v-btn>
           <v-btn icon="mdi-delete-outline" variant="text" size="small" color="error" @click="deleteItem(item)"></v-btn>
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="600px" persistent>
      <v-card class="glassmorphism-card">
        <v-card-title class="dialog-header">
          <span class="text-h5">{{ dialogTitle }}</span>
        </v-card-title>
        <v-card-text class="py-4">
          <v-form ref="form">
            <v-autocomplete
              v-model="editedItem.gestao_click_id"
              :items="gestaoClickProducts"
              item-title="nome"
              item-value="id"
              label="Selecione o Tecido do Gestão Click"
              variant="outlined"
              :rules="[rules.required]"
              @update:modelValue="onProductSelect"
              :disabled="!!editedItem.id"
              class="mb-4"
            ></v-autocomplete>

            <v-text-field
              v-model="editedItem.fabric_type"
              label="Nome do Tecido (preenchido automaticamente)"
              variant="outlined"
              readonly
              class="mb-4"
            ></v-text-field>

            <v-select
              v-model="editedItem.unit_of_measure"
              :items="['metro', 'kg']"
              label="Unidade de Medida"
              variant="outlined"
              :rules="[rules.required]"
              class="mb-4"
            ></v-select>

            <v-text-field
              v-if="editedItem.unit_of_measure === 'kg'"
              v-model.number="editedItem.rendimento"
              label="Rendimento (metros por kg)"
              type="number"
              variant="outlined"
              hint="Exemplo: 3.5"
              persistent-hint
              :rules="[rules.required, rules.positive]"
              class="mb-4"
            ></v-text-field>

            <v-text-field
              v-model.number="editedItem.meters_per_roll"
              label="Metros por Rolo (opcional)"
              type="number"
              variant="outlined"
            ></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions class="dialog-footer">
          <v-spacer></v-spacer>
          <v-btn text @click="closeDialog">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" @click="save" :loading="isSaving">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { supabase } from '@/api/supabase';
import { gestaoApi } from '@/api/gestaoClick';
import type { VForm } from 'vuetify/components';

type StockItem = {
  id: string;
  fabric_type: string;
  gestao_click_id: string;
  unit_of_measure: 'metro' | 'kg';
  rendimento: number | null;
  meters_per_roll: number | null;
};

type GestaoClickProduct = {
  id: string;
  nome: string;
};

const stockItems = ref<StockItem[]>([]);
const gestaoClickProducts = ref<GestaoClickProduct[]>([]);
const loading = ref(true);
const dialog = ref(false);
const isSaving = ref(false);
const form = ref<VForm | null>(null);

const editedItem = ref<Partial<StockItem>>({});

const rules = {
  required: (v: any) => !!v || 'Campo obrigatório.',
  positive: (v: number) => v > 0 || 'O valor deve ser maior que zero.',
};

const headers = [
  { title: 'Tecido', key: 'fabric_type', sortable: true },
  { title: 'Unidade', key: 'unit_of_measure', sortable: true },
  { title: 'Rendimento', key: 'rendimento', sortable: false },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
];

const dialogTitle = computed(() => editedItem.value.id ? `Editar ${editedItem.value.fabric_type}` : 'Configurar Novo Tecido');

const fetchData = async () => {
  loading.value = true;
  try {
    const [stockData, productsData] = await Promise.all([
      supabase.from('stock').select('*').order('fabric_type'),
      gestaoApi.buscarProdutos()
    ]);

    if (stockData.error) throw stockData.error;
    stockItems.value = stockData.data || [];
    gestaoClickProducts.value = productsData || [];
  } catch (err: any) {
    alert(`Erro ao buscar dados: ${err.message}`);
  } finally {
    loading.value = false;
  }
};

const openDialog = (item?: StockItem) => {
  editedItem.value = item ? { ...item } : { unit_of_measure: 'metro' };
  dialog.value = true;
};

const onProductSelect = (selectedId: string) => {
    const product = gestaoClickProducts.value.find(p => p.id === selectedId);
    if (product) {
        editedItem.value.fabric_type = product.nome;
    }
}

const closeDialog = () => {
  dialog.value = false;
};

const deleteItem = async (item: StockItem) => {
    if (confirm(`Tem certeza que deseja apagar a configuração do tecido "${item.fabric_type}"?`)) {
        try {
            const { error } = await supabase.from('stock').delete().eq('id', item.id);
            if (error) throw error;
            await fetchData();
        } catch (err: any) {
            alert(`Erro ao apagar: ${err.message}`);
        }
    }
}

const save = async () => {
  if (isSaving.value) return;
  const { valid } = await form.value!.validate();
  if (!valid) return;

  isSaving.value = true;

  const payload = { ...editedItem.value };
  if (payload.unit_of_measure !== 'kg') {
      payload.rendimento = null;
  }

  try {
    const { error } = await supabase.from('stock').upsert(payload).select();
    if (error) throw error;

    await fetchData();
    closeDialog();
  } catch (err: any) {
    alert(`Erro ao salvar: ${err.message}`);
  } finally {
    isSaving.value = false;
  }
};

onMounted(fetchData);
</script>

<style scoped lang="scss">
.glassmorphism-card-stock, .glassmorphism-card {
  backdrop-filter: blur(15px);
  background-color: rgba(25, 25, 30, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}
.dialog-header { border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.dialog-footer { border-top: 1px solid rgba(255, 255, 255, 0.1); }
</style>
