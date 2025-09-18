<template>
  <v-dialog :model-value="show" @update:model-value="$emit('close')" max-width="1200px" persistent scrollable>
    <v-card class="glassmorphism-card-dialog">
      <v-toolbar color="transparent">
        <v-toolbar-title class="font-weight-bold">
          Itens do Pedido #{{ String(order?.order_number).padStart(4, '0') }}
        </v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" @click="$emit('close')"></v-btn>
      </v-toolbar>

      <v-card-text v-if="order">
        <div class="order-info-header">
          <div>
            <div class="text-caption text-grey">CLIENTE</div>
            <div class="text-h6 font-weight-bold">{{ order.customer_name }}</div>
          </div>
          <div>
            <div class="text-caption text-grey">VENDEDOR</div>
            <div class="text-h6">{{ order.creator_name }}</div>
          </div>
        </div>

        <v-list class="bg-transparent item-list">
          <template v-for="(item, index) in localItems" :key="item.id">
            <v-list-item class="item-row pa-4">
              <template #prepend>
                <v-img
                  :src="item.stamp_image_url"
                  class="item-thumbnail elevation-2"
                  aspect-ratio="1"
                  cover
                ></v-img>
              </template>

              <v-list-item-title class="font-weight-bold text-body-1">{{ item.stamp_ref }}</v-list-item-title>
              <v-list-item-subtitle>{{ item.fabric_type }} - {{ formatMeters(item.quantity_meters) }}m</v-list-item-subtitle>

              <template #append>
                <div class="d-flex align-center ga-2 item-actions">
                  <v-chip
                    size="small"
                    :color="statusInfo(item.status).color"
                    :prepend-icon="statusInfo(item.status).icon"
                    variant="tonal"
                    class="font-weight-bold"
                    label
                  >
                    {{ statusInfo(item.status).text }}
                  </v-chip>

                  <v-btn
                    v-if="userStore.isAdmin"
                    @click="toggleOpGenerated(item)"
                    :color="item.is_op_generated ? 'info' : 'grey'"
                    variant="tonal"
                    size="small"
                  >
                    OP
                    <v-icon end>{{ item.is_op_generated ? 'mdi-check' : 'mdi-close' }}</v-icon>
                    <v-tooltip activator="parent" location="top">
                      {{ item.is_op_generated ? 'OP Liberada' : 'OP Não Liberada' }}
                    </v-tooltip>
                  </v-btn>

                  <v-btn
                    v-if="item.is_op_generated"
                    icon="mdi-file-pdf-box"
                    variant="text"
                    color="info"
                    size="small"
                    @click="generatePdf(item, order)"
                  >
                    <v-tooltip activator="parent" location="top">Gerar PDF da OP</v-tooltip>
                  </v-btn>

                  <v-btn
                    v-if="canReleaseItem(item)"
                    color="primary"
                    variant="flat"
                    @click="releaseItemForProduction(item)"
                    :loading="releasing[item.id]"
                  >
                    <v-icon start>mdi-send</v-icon>
                    Liberar
                  </v-btn>
                </div>
              </template>
            </v-list-item>
            <v-divider v-if="index < localItems.length - 1"></v-divider>
          </template>
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch, reactive } from 'vue';
import { supabase } from '@/api/supabase';
import { useUserStore } from '@/stores/user';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const props = defineProps<{
  show: boolean;
  order: any | null;
}>();
const emit = defineEmits(['close', 'update-items']);

const userStore = useUserStore();
const releasing = reactive<Record<string, boolean>>({});
const localItems = ref<any[]>([]);

const statusInfo = (status: string) => {
    const map: Record<string, { text: string, color: string, icon: string }> = {
        production_queue: { text: 'Na Fila', color: 'grey', icon: 'mdi-timer-sand' },
        completed: { text: 'Concluído', color: 'success', icon: 'mdi-check-circle' },
        in_printing: { text: 'Em Produção', color: 'primary', icon: 'mdi-cog-sync' },
        in_cutting: { text: 'Em Produção', color: 'primary', icon: 'mdi-cog-sync' }
    };
    return map[status] || { text: status, color: 'default', icon: 'mdi-help-circle' };
};

watch(() => props.order, (newOrder) => {
    if (newOrder) {
        // Clona os itens para um estado local para poder modificá-los
        localItems.value = JSON.parse(JSON.stringify(newOrder.items));
    } else {
        localItems.value = [];
    }
}, { immediate: true, deep: true });

// Verifica se um item está em um estado que permite a liberação
const canReleaseItem = (item: any) => {
    return userStore.isAdmin && (item.status === 'production_queue' || item.status === 'completed');
};

// AÇÃO DE LIBERAR O ITEM
const releaseItemForProduction = async (item: any) => {
    if(!confirm(`Tem certeza que deseja liberar o item "${item.stamp_ref}" para a produção? Esta ação não pode ser desfeita.`)) return;

    releasing[item.id] = true;
    try {
        // Atualiza o status do item no banco de dados para o primeiro estágio da produção
        const { error } = await supabase
            .from('order_items')
            .update({ status: 'in_printing' })
            .eq('id', item.id);

        if (error) throw error;

        // ATUALIZA O ESTADO LOCAL: Isso garante que o botão mude imediatamente para o feedback de sucesso
        const foundItem = localItems.value.find(i => i.id === item.id);
        if (foundItem) {
            foundItem.status = 'in_printing';
        }

        // EMITE UM EVENTO: Isso avisa o componente pai (Liberacao.vue) para recarregar seus dados
        emit('update-items');

    } catch (err) {
        console.error("Erro ao liberar item para produção:", err);
        alert('Falha ao liberar o item. Por favor, tente novamente.');
    } finally {
        releasing[item.id] = false;
    }
};

const formatMeters = (meters: number) => Number(meters || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

const toggleOpGenerated = async (item: any) => {
    const originalValue = item.is_op_generated;
    const newValue = !originalValue
    try {
        const { error } = await supabase.from('order_items').update({ is_op_generated: newValue }).eq('id', item.id);
        if (error) throw error;
        item.is_op_generated = newValue;
    } catch (err) {
        console.error("Erro ao atualizar a flag is_op_generated:", err);
        item.is_op_generated = originalValue;
        alert("Ocorreu um erro ao tentar salvar a liberação da OP.");
    }
};

// As funções de gerar PDF e de data permanecem as mesmas
const imageToBase64 = (url: string): Promise<string> => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        } else { reject(new Error('Contexto do canvas não obtido')); }
    };
    img.onerror = reject;
    img.src = url;
});

const addBusinessDays = (startDate: Date, days: number): Date => {
  const newDate = new Date(startDate);
  let addedDays = 0;
  while (addedDays < days) {
    newDate.setDate(newDate.getDate() + 1);
    if (newDate.getDay() !== 0) addedDays++;
  }
  return newDate;
};

const getNextDeliveryDay = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    while (true) {
        if ([2, 4, 6].includes(newDate.getDay())) return newDate;
        newDate.setDate(newDate.getDate() + 1);
    }
};

const generatePdf = async (item: any, parentOrder: any) => {
  try {
    const { data: opNumber, error: rpcError } = await supabase.rpc('generate_op_number', { p_item_id: item.id });
    if (rpcError) throw rpcError;

    const { data: schedule, error: scheduleError } = await supabase.from('production_schedule').select('scheduled_date').eq('order_item_id', item.id).single();
    if (scheduleError || !schedule) throw new Error('Agendamento do item não encontrado.');

    const completionDate = addBusinessDays(parseISO(schedule.scheduled_date), 3);
    const forecastDate = getNextDeliveryDay(completionDate);
    const formattedOpNumber = String(opNumber).padStart(4, '0');

    const doc = new jsPDF();
    autoTable(doc, {
        body: [
            [`OP #${formattedOpNumber} - Pedido #${parentOrder.order_number}`],
            [`Cliente: ${parentOrder.customer_name}`],
            [`Item: ${item.stamp_ref} - ${item.fabric_type}`],
            [`Metragem: ${item.quantity_meters}m`],
            [`Previsão de Entrega: ${format(forecastDate, 'dd/MM/yyyy')}`]
        ]
    });
    if (item.stamp_image_url) {
        const artBase64 = await imageToBase64(item.stamp_image_url);
        doc.addImage(artBase64, 'PNG', 15, (doc as any).lastAutoTable.finalY + 10, 80, 80);
    }
    doc.save(`OP-${formattedOpNumber}-${parentOrder.customer_name}-${item.stamp_ref}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Não foi possível gerar o PDF.");
  }
};
</script>

<style scoped lang="scss">
.glassmorphism-card-dialog {
  backdrop-filter: blur(20px) !important;
  background-color: rgba(40, 40, 45, 0.9) !important;
  border-radius: 12px !important;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.order-info-header {
  display: flex;
  justify-content: space-between;
  padding: 16px 24px;
  background-color: rgba(0,0,0,0.2);
  border-radius: 8px;
  margin-bottom: 16px;
}

.item-list {
  padding: 0;
}

.item-row {
  min-height: 90px;
  transition: background-color 0.2s ease-in-out;
  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
}

.item-thumbnail {
  width: 60px;
  height: 60px;
  border-radius: 8px;
}

.item-actions {
  min-width: 380px; // Garante espaço para os botões
  justify-content: flex-end;
}
</style>
