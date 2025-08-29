<template>
  <v-dialog :model-value="show" @update:model-value="$emit('close')" max-width="800px" persistent>
    <v-card class="glassmorphism-card">
      <v-toolbar color="transparent" density="compact">
        <v-toolbar-title class="font-weight-bold">Detalhes do Pedido</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" @click="$emit('close')"></v-btn>
      </v-toolbar>

      <div v-if="loading" class="text-center py-16">
        <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
      </div>
      <v-alert v-else-if="error" type="error" prominent class="ma-4">{{ error }}</v-alert>

      <v-card-text v-else-if="order" class="py-4">
        <v-row>
          <v-col cols="12" md="7">
            <v-list density="compact" bg-color="transparent">
              <v-list-item title="Cliente" :subtitle="order.customer_name"></v-list-item>
              <v-list-item title="Status Geral">
                 <template #subtitle>
                    <v-chip size="small" :color="statusColorMap[order.status]" variant="flat">{{ statusDisplayMap[order.status] || order.status }}</v-chip>
                 </template>
              </v-list-item>
              <v-list-item title="Criado por" :subtitle="order.profiles?.full_name || 'N/A'"></v-list-item>
              <v-list-item title="Loja de Origem" :subtitle="order.stores?.name || 'N/A'"></v-list-item>
            </v-list>
          </v-col>
          <v-col cols="12" md="5">
             <h4 class="text-subtitle-1 font-weight-bold mb-2">Detalhes Gerais</h4>
              <v-list density="compact" bg-color="transparent" lines="two">
                  <v-list-item title="Tipo">
                    <template #subtitle>
                      <v-chip size="small">{{ order.is_launch ? `Lançamento (${order.order_items.length} itens)` : 'Pedido Único' }}</v-chip>
                    </template>
                  </v-list-item>
                  <v-list-item title="Metragem Total" :subtitle="`${order.quantity_meters}m`"></v-list-item>
              </v-list>
          </v-col>
        </v-row>

        <v-divider class="my-4"></v-divider>

        <div v-if="!order.is_launch && order.details">
             <h4 class="text-subtitle-1 font-weight-bold mb-2">Observações da Estampa</h4>
             <p class="text-body-2 text-medium-emphasis pa-2">{{ order.details.stamp_details }}</p>
        </div>

        <div v-else-if="order.is_launch">
            <h4 class="text-subtitle-1 font-weight-bold mb-2">Itens do Lançamento</h4>
            <div v-for="item in order.order_items" :key="item.id" class="item-row-detail">
              <div class="d-flex align-center">
                <v-img :src="item.stamp_image_url" class="item-thumbnail mr-4" cover></v-img>
                <div>
                  <span class="font-weight-bold">{{ item.stamp_ref }}</span>
                  <span class="text-caption d-block">{{ item.fabric_type }} - {{ item.quantity_meters }}m</span>
                </div>
              </div>
              <div class="d-flex align-center">
                <v-chip size="small" :color="statusColorMap[item.status]" label>{{ statusDisplayMap[item.status] || item.status }}</v-chip>
                <v-btn
                  v-if="item.is_op_generated"
                  color="info"
                  variant="text"
                  size="small"
                  class="ml-2"
                  icon="mdi-file-pdf-box"
                  @click="emit('generatePdf', item)"
                >
                  <v-icon></v-icon>
                  <v-tooltip activator="parent" location="top">Gerar Ordem de Produção</v-tooltip>
                </v-btn>
              </div>
            </div>
        </div>
      </v-card-text>

      <v-card-actions class="dialog-footer">
        <v-spacer></v-spacer>
        <v-btn text @click="$emit('close')">Fechar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { supabase } from '@/api/supabase';

const props = defineProps({
  show: Boolean,
  orderId: String,
});
const emit = defineEmits(['close', 'generatePdf']);

const order = ref<any | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const statusDisplayMap: Record<string, string> = {
    design_pending: 'No Design', in_design: 'Em Design', customer_approval: 'Aprovação Vendedor',
    approved_by_designer: 'Aprovado (Designer)', approved_by_seller: 'Aprovado (Vendedor)',
    production_queue: 'Fila de Produção', in_printing: 'Em Impressão',
    in_cutting: 'Em Corte', completed: 'Finalizado', pending_stock: 'Aguardando Estoque'
};
const statusColorMap: Record<string, string> = {
    design_pending: 'blue-grey', customer_approval: 'orange',
    approved_by_designer: 'teal', approved_by_seller: 'green',
    production_queue: 'grey', in_printing: 'blue', in_cutting: 'purple',
    completed: 'success', pending_stock: 'error'
};

const getStatusColor = (status: string) => statusColorMap[status] || 'grey';

const fetchOrder = async (id: string) => {
  if (!id) return;
  loading.value = true;
  error.value = null;
  try {
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('*, profiles:created_by (full_name), stores (name), order_items(*)')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    order.value = data;
  } catch (e: any) {
    error.value = `Erro ao carregar o pedido: ${e.message}`;
  } finally {
    loading.value = false;
  }
};

watch(() => props.orderId, (newId) => {
  if (newId && props.show) {
    fetchOrder(newId);
  } else {
    order.value = null;
  }
}, { immediate: true });
</script>

<style scoped lang="scss">
.glassmorphism-card {
  backdrop-filter: blur(20px) !important;
  background-color: rgba(30, 30, 30, 0.85) !important;
  border-radius: 12px !important;
}
.dialog-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.item-row-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  &:last-child { border-bottom: none; }
}
.item-thumbnail {
  width: 40px;
  height: 40px;
  border-radius: 4px;
}
</style>
