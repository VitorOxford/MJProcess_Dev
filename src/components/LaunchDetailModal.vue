<template>
  <v-dialog :model-value="show" @update:model-value="$emit('close')" max-width="900px" persistent>
    <v-card class="glassmorphism-card">
      <v-toolbar color="transparent">
        <v-toolbar-title class="font-weight-bold">Gerenciar Itens do Lançamento</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" @click="$emit('close')"></v-btn>
      </v-toolbar>

      <v-card-text v-if="order">
        <h3 class="text-h6 mb-2">Cliente: {{ order.customer_name }}</h3>
        <p class="text-medium-emphasis mb-6">Vendedor: {{ order.created_by.full_name }}</p>

        <div v-for="item in order.order_items" :key="item.id" class="item-management-row">
          <v-img :src="item.stamp_image_url" class="item-thumbnail" cover></v-img>
          <div class="item-info">
            <div class="font-weight-bold">{{ item.stamp_ref }}</div>
            <div class="text-caption">{{ item.fabric_type }} - {{ item.quantity_meters }}m</div>
            <v-chip size="small" :color="tagColors[item.design_tag]" label class="mt-2">{{ item.design_tag }}</v-chip>
          </div>
          <v-spacer></v-spacer>

          <div class="item-actions d-flex align-center justify-end">
            <v-tooltip text="Liberar para gerar Ordem de Produção (PDF)" location="top">
              <template v-slot:activator="{ props }">
                <v-checkbox-btn
                  v-bind="props"
                  v-if="item.status.includes('approved')"
                  :model-value="item.is_op_generated"
                  @update:modelValue="(val) => handleCheckChange(item, val)"
                  color="info"
                  class="mr-2"
                ></v-checkbox-btn>
              </template>
            </v-tooltip>

            <v-chip v-if="item.status.includes('approved')" color="success" variant="flat">
              <v-icon start>mdi-check</v-icon>
              Aprovado
            </v-chip>
            <v-chip v-else-if="item.status === 'customer_approval'" color="orange" variant="tonal">
              <v-icon start>mdi-account-clock-outline</v-icon>
              Aguardando Vendedor
            </v-chip>
            <div v-else class="d-flex flex-column ga-2" style="min-width: 180px;">
              <v-btn
                v-if="item.design_tag === 'Finalização'"
                color="success"
                @click="emit('approve', item)"
              >
                Aprovar Direto
              </v-btn>
              <v-btn
                v-else
                color="primary"
                @click="emit('sendToSeller', item)"
              >
                Enviar para Aprovação
              </v-btn>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { supabase } from '@/api/supabase';
import { useUserStore } from '@/stores/user';

defineProps({
  show: Boolean,
  order: Object as () => any | null,
});

const emit = defineEmits(['close', 'approve', 'sendToSeller']);

const tagColors = {
  'Desenvolvimento': 'primary',
  'Alteração': 'warning',
  'Finalização': 'success',
};

const handleCheckChange = async (item: any, isChecked: boolean) => {
  const userStore = useUserStore();
  try {
    const { error } = await supabase.rpc('toggle_item_op_generation', {
      p_item_id: item.id,
      p_is_generated: isChecked,
      p_profile_id: userStore.profile?.id,
    });
    if (error) throw error;
    item.is_op_generated = isChecked; // Atualiza o estado localmente no modal
  } catch (err) {
    console.error("Erro ao atualizar o 'check' do item:", err);
    // Opcional: reverter a mudança na UI se a DB falhar
    item.is_op_generated = !isChecked;
  }
};
</script>

<style scoped lang="scss">
.glassmorphism-card {
  backdrop-filter: blur(20px) !important;
  background-color: rgba(30, 30, 30, 0.85) !important;
  border-radius: 12px !important;
}
.item-management-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: rgba(255,255,255,0.05);
  border-radius: 8px;
  margin-bottom: 12px;
}
.item-thumbnail {
  width: 70px;
  height: 70px;
  border-radius: 8px;
  flex-shrink: 0;
}
.item-info {
  flex-grow: 1;
}
.item-actions {
  min-width: 220px;
  text-align: right;
}
</style>
