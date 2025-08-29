<template>
  <v-container fluid class="delivery-container pa-md-6 pa-4">
    <v-toolbar color="transparent" class="mb-6">
      <v-toolbar-title class="font-weight-bold text-h5">
        <v-icon start size="x-large" class="mr-2">mdi-truck-delivery-outline</v-icon>
        Agenda de Entregas
      </v-toolbar-title>
      <v-spacer></v-spacer>
      <div class="d-flex align-center">
        <v-btn icon="mdi-chevron-left" variant="text" @click="previousWeek"></v-btn>
        <div class="week-indicator mx-2 text-center" style="min-width: 180px;">
          <div class="font-weight-bold">{{ weekRangeText }}</div>
        </div>
        <v-btn icon="mdi-chevron-right" variant="text" @click="nextWeek"></v-btn>
      </div>
    </v-toolbar>

    <div v-if="loading" class="text-center py-16">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
    </div>

    <div v-else>
      <div class="delivery-board">
        <div class="delivery-column to-be-scheduled-column">
          <div class="column-header">
            <v-icon class="header-icon">mdi-clipboard-clock-outline</v-icon>
            <div>
              <h3 class="column-title text-h6">Aguardando Envio</h3>
              <p class="text-caption text-grey">{{ toBeScheduledOrders.length }} pedido(s)</p>
            </div>
          </div>
          <draggable
            :list="toBeScheduledOrders"
            group="orders"
            item-key="id"
            class="column-content pa-3"
            ghost-class="ghost-card"
            @end="onDragEnd"
            data-status="to-be-scheduled"
          >
            <template #item="{ element: order }">
               <v-card class="order-card mb-4" elevation="4" @click="openDetailModal(order.id)" :data-id="order.id">
                <v-card-text>
                  <p class="font-weight-bold text-subtitle-1">{{ order.customer_name }}</p>
                  <v-chip v-if="order.is_launch" size="small" variant="tonal" color="info" class="mt-2">
                    <v-icon start size="x-small">mdi-package-variant-closed</v-icon>
                    Lançamento com {{ order.order_items.length }} itens
                  </v-chip>
                  <p v-else class="info-line"><v-icon size="small">mdi-layers-triple-outline</v-icon> {{ order.details.fabric_type }}</p>
                  <p class="info-line"><v-icon size="small">mdi-ruler-square</v-icon> {{ order.quantity_meters }}m</p>
                </v-card-text>
              </v-card>
            </template>
          </draggable>
        </div>

        <div v-for="day in weekDeliveryDays" :key="day.date.toISOString()" class="delivery-column">
          <div class="column-header">
            <v-icon class="header-icon">mdi-calendar-blank-outline</v-icon>
            <div>
              <h3 class="column-title text-h6">{{ day.name }}</h3>
              <p class="text-caption text-grey">{{ formatDate(day.date, 'dd/MM') }}</p>
            </div>
          </div>
          <draggable
            :list="day.orders"
            group="orders"
            item-key="id"
            class="column-content pa-3"
            :data-date="day.date.toISOString().split('T')[0]"
            ghost-class="ghost-card"
            @end="onDragEnd"
          >
            <template #item="{ element: order }">
               <v-card
                  class="order-card mb-4"
                  :class="{ 'confirmed': order.delivery_confirmed_at, 'past-delivery': isPast(day.date) && !isToday(day.date) }"
                  elevation="4"
                  @click="openDetailModal(order.id)"
                  :data-id="order.id"
                >
                  <v-icon v-if="order.delivery_confirmed_at" class="confirmed-icon" color="success">mdi-check-circle</v-icon>
                  <v-card-text>
                      <p class="font-weight-bold text-subtitle-1">{{ order.customer_name }}</p>
                      <v-chip v-if="order.is_launch" size="small" variant="tonal" color="info" class="mt-2">
                        <v-icon start size="x-small">mdi-package-variant-closed</v-icon>
                        {{ order.order_items.length }} itens
                      </v-chip>
                      <p class="info-line"><v-icon size="small">mdi-ruler-square</v-icon> {{ order.quantity_meters }}m</p>
                  </v-card-text>
                  <v-fade-transition>
                    <v-card-actions class="actions-overlay" v-if="!order.delivery_confirmed_at">
                      <v-tooltip text="Cancelar Agendamento" location="top">
                          <template v-slot:activator="{ props }">
                              <v-btn v-bind="props" icon="mdi-close" color="red" variant="flat" size="small" @click.stop="rejectDelivery(order)"></v-btn>
                          </template>
                      </v-tooltip>
                      <v-tooltip text="Confirmar Entrega" location="top">
                        <template v-slot:activator="{ props }">
                          <v-btn v-bind="props" icon="mdi-check" color="success" variant="flat" size="small" @click.stop="confirmDelivery(order)"></v-btn>
                        </template>
                      </v-tooltip>
                    </v-card-actions>
                    <v-card-actions class="actions-overlay" v-else-if="userStore.isAdmin && order.delivery_confirmed_at">
                       <v-tooltip text="Reverter Entrega (Admin)" location="top">
                          <template v-slot:activator="{ props }">
                              <v-btn v-bind="props" icon="mdi-undo-variant" color="warning" variant="flat" size="small" @click.stop="rejectDelivery(order)"></v-btn>
                          </template>
                      </v-tooltip>
                    </v-card-actions>
                  </v-fade-transition>
              </v-card>
            </template>
          </draggable>
        </div>
      </div>

      <v-card class="mt-8 history-card" color="rgba(30,30,35,0.8)">
        <v-toolbar color="transparent">
          <v-toolbar-title class="font-weight-bold">
            <v-icon start>mdi-history</v-icon>
            Histórico de Entregas (Últimos 30 dias)
          </v-toolbar-title>
        </v-toolbar>
        <v-data-table
          :headers="historyHeaders"
          :items="deliveredOrders"
          class="bg-transparent"
          item-value="id"
        >
          <template v-slot:item.actual_delivery_date="{ item }">
            <span>{{ formatDate(item.actual_delivery_date, 'dd/MM/yyyy') }}</span>
          </template>
          <template v-slot:item.customer_name="{ item }">
            <span class="font-weight-bold">{{ item.customer_name }}</span>
          </template>
        </v-data-table>
      </v-card>
    </div>

    <OrderDetailModal :show="showDetailModal" :order-id="selectedOrderId" @close="showDetailModal = false"/>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { supabase } from '@/api/supabase';
import OrderDetailModal from '@/components/OrderDetailModal.vue';
import draggable from 'vuedraggable';
import { useUserStore } from '@/stores/user';
import { format, addDays, startOfToday, getDay, isSameDay, parseISO, isBefore, startOfWeek, endOfWeek, subDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Types
type OrderItem = { id: string; status: string; };
type Order = {
  id: string; customer_name: string; quantity_meters: number; status: string;
  is_launch: boolean; details: { fabric_type: string; };
  actual_delivery_date: Date | null; delivery_confirmed_at: string | null;
  order_items: OrderItem[];
  creator: { full_name: string; } | null;
};

// State
const userStore = useUserStore();
const loading = ref(true);
const showDetailModal = ref(false);
const selectedOrderId = ref<string | null>(null);
const allOrders = ref<Order[]>([]);
const currentDeliveryWeekStart = ref(startOfWeek(new Date(), { weekStartsOn: 1 }));

const historyHeaders = [
  { title: 'Cliente', key: 'customer_name' },
  { title: 'Data da Entrega', key: 'actual_delivery_date' },
  { title: 'Metragem', key: 'quantity_meters' },
  { title: 'Vendedor', key: 'creator.full_name' },
];

const toBeScheduledOrders = computed(() => allOrders.value.filter(o => o.status === 'completed' && !o.actual_delivery_date));
const scheduledOrders = computed(() => allOrders.value.filter(o => !!o.actual_delivery_date));
const deliveredOrders = computed(() => {
    const thirtyDaysAgo = subDays(startOfToday(), 30);
    return scheduledOrders.value.filter(o => o.delivery_confirmed_at && o.actual_delivery_date && isBefore(o.actual_delivery_date, startOfToday()) && !isBefore(o.actual_delivery_date, thirtyDaysAgo))
        .sort((a,b) => (b.actual_delivery_date?.getTime() || 0) - (a.actual_delivery_date?.getTime() || 0));
});

const weekDeliveryDays = computed(() => {
    const weekStart = currentDeliveryWeekStart.value;
    const days = [ { name: 'Terça-feira', dayOfWeek: 2 }, { name: 'Quinta-feira', dayOfWeek: 4 }, { name: 'Sábado', dayOfWeek: 6 }, ];
    return days.map(dayInfo => {
        let currentDate = weekStart;
        while (getDay(currentDate) !== dayInfo.dayOfWeek) {
            currentDate = addDays(currentDate, 1);
        }
        return {
            name: dayInfo.name, date: currentDate,
            orders: scheduledOrders.value.filter(o => o.actual_delivery_date && isSameDay(o.actual_delivery_date, currentDate))
        };
    });
});


const isPast = (date: Date): boolean => isBefore(date, startOfToday());
const weekRangeText = computed(() => `${format(currentDeliveryWeekStart.value, 'dd MMM', { locale: ptBR })} - ${format(endOfWeek(currentDeliveryWeekStart.value, { weekStartsOn: 1 }), 'dd MMM', { locale: ptBR })}`);
const nextWeek = () => currentDeliveryWeekStart.value = addDays(currentDeliveryWeekStart.value, 7);
const previousWeek = () => currentDeliveryWeekStart.value = subDays(currentDeliveryWeekStart.value, 7);

const onDragEnd = async (event: any) => {
    const { item, to } = event;
    const orderId = item.dataset.id;
    const newDateStr = to.dataset.date;
    if (!orderId) return;

    const newDate = newDateStr ? newDateStr : null;
    try {
        // CORREÇÃO: Atualiza a tabela 'production_schedule'
        const { error } = await supabase
            .from('production_schedule')
            .update({ actual_delivery_date: newDate })
            .eq('order_id', orderId);

        if (error) throw error;

        if (newDate && isPast(parseISO(newDate)) && !isToday(parseISO(newDate))) {
            const order = allOrders.value.find(o => o.id === orderId);
            if(order) await confirmDelivery(order);
        } else {
             await fetchDeliveryOrders();
        }
    } catch (err: any) {
        console.error('Erro ao reagendar entrega:', err.message);
    }
};

const confirmDelivery = async (order: Order) => {
  try {
    // CORREÇÃO: Atualiza a tabela 'production_schedule'
    const { error } = await supabase
        .from('production_schedule')
        .update({ delivery_confirmed_at: new Date().toISOString() })
        .eq('order_id', order.id);
    if (error) throw error;
    await fetchDeliveryOrders();
  } catch (err: any) {
    console.error('Erro ao confirmar entrega:', err.message);
  }
};

const rejectDelivery = async (order: Order) => {
    try {
        // CORREÇÃO: Atualiza a tabela 'production_schedule'
        const { error } = await supabase
            .from('production_schedule')
            .update({ delivery_confirmed_at: null, actual_delivery_date: null })
            .eq('order_id', order.id);
        if (error) throw error;
        await fetchDeliveryOrders();
    } catch (err: any) {
        console.error('Erro ao cancelar entrega:', err.message);
    }
};

const openDetailModal = (orderId: string) => {
  selectedOrderId.value = orderId;
  showDetailModal.value = true;
};

const formatDate = (date: Date | string | null | undefined, formatString: string) => {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  return format(dateObj, formatString, { locale: ptBR });
};

const fetchDeliveryOrders = async () => {
  loading.value = true;
  try {
    // CORREÇÃO: O SELECT agora faz um join explícito para pegar os dados corretos
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, customer_name, quantity_meters, status, is_launch, details,
        creator:created_by(full_name),
        production_schedule(actual_delivery_date, delivery_confirmed_at),
        order_items(id, status)
      `)
      .in('status', ['completed', 'delivered']);

    if (error) throw error;

    // CORREÇÃO: Mapeia os dados do join para o objeto principal
    allOrders.value = (data || []).map((o: any) => ({
        ...o,
        actual_delivery_date: o.production_schedule[0]?.actual_delivery_date ? parseISO(o.production_schedule[0].actual_delivery_date) : null,
        delivery_confirmed_at: o.production_schedule[0]?.delivery_confirmed_at
    }));
  } catch (err: any) {
    console.error('Erro ao buscar pedidos para entrega:', err.message);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchDeliveryOrders);

</script>

<style scoped lang="scss">
/* (Estilos mantidos) */
.delivery-container { padding: 1rem; }
.delivery-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; }
.delivery-column { background-color: rgba(30, 30, 35, 0.7); border-radius: 16px; display: flex; flex-direction: column; border: 1px solid rgba(255, 255, 255, 0.1); max-height: calc(100vh - 280px); }
.to-be-scheduled-column { background-color: rgba(60, 50, 70, 0.6); }
.column-header { padding: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; gap: 0.75rem; }
.column-content { flex-grow: 1; overflow-y: auto; min-height: 200px; }
.order-card { cursor: grab; position: relative; background-color: rgba(45, 45, 55, 0.9); transition: all 0.2s ease-in-out; border: 1px solid transparent; }
.order-card:hover { transform: translateY(-4px); border-color: rgba(var(--v-theme-primary), 0.5); }
.info-line { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #e0e0e0; margin-top: 4px; }
.ghost-card { opacity: 0.5; background: rgba(var(--v-theme-primary), 0.2); border: 2px dashed rgba(var(--v-theme-primary), 0.5); }
.actions-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); padding: 8px; display: flex; justify-content: center; gap: 16px; opacity: 0; transition: opacity 0.2s ease-in-out; }
.order-card:not(.past-delivery):not(.ghost):hover .actions-overlay { opacity: 1; }
.confirmed-icon { position: absolute; top: 8px; right: 8px; font-size: 2rem; opacity: 0.5; }
.history-card { border-radius: 12px; }
</style>
