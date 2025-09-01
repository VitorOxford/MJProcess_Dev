<template>
  <v-container fluid class="design-kanban-page">
    <v-toolbar color="transparent" class="mb-4 px-0">
      <v-toolbar-title class="font-weight-bold text-h4 d-flex align-center">
        <v-icon start size="36" color="primary">mdi-palette-swatch-outline</v-icon>
        Fluxo de Design
      </v-toolbar-title>
    </v-toolbar>

    <div v-if="loading" class="text-center py-16">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
    </div>

    <div v-else class="kanban-board-container custom-scrollbar">
      <div class="kanban-board">
        <div v-for="(column, index) in columns" :key="column.id" class="kanban-column" :style="{ '--animation-delay': `${index * 0.2}s` }">
          <div class="column-header">
            <v-icon :color="column.color" class="mr-3">{{ column.icon }}</v-icon>
            <h3 class="column-title">{{ column.title }}</h3>
            <v-chip size="small" variant="tonal" class="ml-auto" :color="column.color">{{ column.orders.length }}</v-chip>
          </div>

          <draggable
            :list="column.orders"
            group="orders"
            item-key="id"
            class="column-content custom-scrollbar"
            :disabled="column.id === 4"
          >
            <template #item="{ element: order }">
               <div :data-id="order.id" @mousemove="onCardMouseMove">
                  <v-card class="order-card my-2" variant="flat" @click="openModalForOrder(order)">
                     <div class="card-border"></div>
                     <div class="card-shine"></div>
                     <v-card-text class="card-content">
                       <p class="font-weight-bold text-body-1">{{ order.customer_name }}</p>
                       <p class="text-caption text-medium-emphasis mt-1">Vendedor: {{ order.created_by.full_name }}</p>
                       <v-divider class="my-2"></v-divider>
                       <v-chip size="small">{{ order.is_launch ? `${order.order_items.length} itens` : 'Pedido Único' }}</v-chip>
                     </v-card-text>
                  </v-card>
               </div>
            </template>
          </draggable>
           <div v-if="column.orders.length === 0" class="empty-column">
              <v-icon size="48" class="mb-2 text-grey-darken-2">mdi-tray-arrow-down</v-icon>
              <span>Nenhum pedido aqui.</span>
          </div>
        </div>
      </div>
    </div>

    <LaunchDetailModal
      :show="showLaunchModal"
      :order="selectedOrder"
      @close="closeLaunchModal"
      @approve="handleDesignerApproval"
      @sendToSeller="openUploadModal"
      @releaseToProduction="releaseToProduction"
      @releaseItem="handleReleaseItem"
    />
    <FileUploadModal
      :show="showUploadModal"
      :order="selectedOrder"
      :title="uploadModalTitle"
      @close="showUploadModal = false"
      @uploaded="handleUploadSuccess"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onActivated } from 'vue';
import { supabase } from '@/api/supabase';
import { useUserStore } from '@/stores/user';
import draggable from 'vuedraggable';
import LaunchDetailModal from '@/components/LaunchDetailModal.vue';
import FileUploadModal from '@/components/FileUploadModal.vue';

type OrderItem = { id: string; status: string; design_tag: 'Desenvolvimento' | 'Alteração' | 'Finalização' | 'Aprovado'; order_id: string; [key: string]: any };
type Order = { id: string; status: string; is_launch: boolean; order_items: OrderItem[]; [key: string]: any };

const loading = ref(true);
const allDesignOrders = ref<Order[]>([]);
const userStore = useUserStore();
const showLaunchModal = ref(false);
const selectedOrder = ref<Order | null>(null);
const showUploadModal = ref(false);
const selectedItem = ref<OrderItem | null>(null);
const uploadModalTitle = ref('');

const developmentOrders = computed(() => allDesignOrders.value.filter(order => order.status === 'design_pending' && order.order_items.some(item => item.design_tag === 'Desenvolvimento')));
const alterationOrders = computed(() => allDesignOrders.value.filter(order => order.status === 'design_pending' && order.order_items.some(item => item.design_tag === 'Alteração')));
const finalizationOrders = computed(() => allDesignOrders.value.filter(order => order.status === 'design_pending' && order.order_items.some(item => item.design_tag === 'Finalização')));
const approvedOrders = computed(() => allDesignOrders.value.filter(order => order.status === 'customer_approval' || order.order_items.some(item => item.status === 'approved_by_seller')));

const columns = computed(() => [
  { id: 1, title: 'Desenvolvimento', icon: 'mdi-lightbulb-on-outline', color: '#40c4ff', orders: developmentOrders.value },
  { id: 2, title: 'Alteração', icon: 'mdi-swap-horizontal-bold', color: '#ffab40', orders: alterationOrders.value },
  { id: 3, title: 'Finalização', icon: 'mdi-flag-checkered', color: '#26A69A', orders: finalizationOrders.value },
  { id: 4, title: 'Aprovados', icon: 'mdi-check-decagram', color: '#4CAF50', orders: approvedOrders.value },
]);

const onCardMouseMove = (e: MouseEvent) => {
  const card = e.currentTarget as HTMLElement;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  card.style.setProperty('--mouse-x', `${x}px`);
  card.style.setProperty('--mouse-y', `${y}px`);
};

const fetchDesignOrders = async () => {
  loading.value = true;
  try {
    const { data, error } = await supabase.from('orders')
      .select(`id, customer_name, status, is_launch, created_by:profiles!created_by(full_name), order_items(*)`)
      .in('status', ['design_pending', 'customer_approval']);
    if (error) throw error;
    allDesignOrders.value = data || [];
  } finally {
    loading.value = false;
  }
};

const openModalForOrder = (order: Order) => {
  selectedOrder.value = order;
  showLaunchModal.value = true;
};

const closeLaunchModal = () => {
  showLaunchModal.value = false;
  selectedOrder.value = null;
};

const openUploadModal = (item: OrderItem) => {
    selectedItem.value = item;
    selectedOrder.value = allDesignOrders.value.find(o => o.id === item.order_id) || null;
    uploadModalTitle.value = `Enviar Arte para "${item.stamp_ref}"`;
    showUploadModal.value = true;
};

const handleDesignerApproval = async (item: OrderItem) => {
    await updateItemStatus(item, 'approved_by_designer');
};

const handleUploadSuccess = async (fileUrl: string) => {
    if (!selectedItem.value) return;
    await updateItemStatus(selectedItem.value, 'customer_approval', fileUrl);
    showUploadModal.value = false;
};

const updateItemStatus = async (item: OrderItem, newStatus: string, fileUrl?: string) => {
    try {
        const { error } = await supabase.rpc('update_order_item_status', { p_item_id: item.id, p_new_status: newStatus, p_final_art_url: fileUrl || null, p_profile_id: userStore.profile?.id });
        if (error) throw error;
        await fetchDesignOrders();
        if (selectedOrder.value) {
          const { data } = await supabase.from('orders').select(`*, created_by:profiles!created_by(full_name), order_items(*)`).eq('id', selectedOrder.value.id).single();
          selectedOrder.value = data;
        }
    } catch (err: any) { console.error("Erro ao atualizar status do item:", err); }
};

// NOVA FUNÇÃO PARA LIBERAR ITEM INDIVIDUAL
const handleReleaseItem = async (item: OrderItem) => {
    try {
        const { error } = await supabase.rpc('update_order_item_status', {
            p_item_id: item.id,
            p_new_status: 'production_queue', // Envia direto para a fila
            p_final_art_url: item.stamp_image_url, // Mantém a URL da arte
            p_profile_id: userStore.profile?.id
        });
        if (error) throw error;
        await fetchDesignOrders();
        if (selectedOrder.value) {
          const { data } = await supabase.from('orders').select(`*, created_by:profiles!created_by(full_name), order_items(*)`).eq('id', selectedOrder.value.id).single();
          selectedOrder.value = data;
        }
    } catch(err: any) {
        console.error("Erro ao liberar item para produção:", err);
    }
};

const releaseToProduction = async (order: Order) => {
    try {
        const { error } = await supabase.rpc('release_order_to_production', {
            p_order_id: order.id,
            p_profile_id: userStore.profile?.id
        });
        if (error) throw error;
        await fetchDesignOrders();
        if(showLaunchModal.value) showLaunchModal.value = false;
    } catch (err: any) { console.error("Erro ao liberar para produção:", err); }
}

onActivated(fetchDesignOrders);
onMounted(fetchDesignOrders);
</script>

<style scoped lang="scss">
@keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-8px); } 100% { transform: translateY(0px); } }
.design-kanban-page { position: relative; z-index: 1; display: flex; flex-direction: column; }
.kanban-board-container { width: 100%; overflow-x: auto; padding-bottom: 2rem; flex-grow: 1; }
.kanban-board { display: flex; gap: 2rem; min-width: fit-content; padding: 1rem; height: 100%; }
.kanban-column { width: 340px; flex-shrink: 0; background-color: rgba(25, 25, 30, 0.6); border-radius: 16px; display: flex; flex-direction: column; max-height: 100%; animation: float 8s ease-in-out infinite; transition: all 0.4s ease; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(5px); }
.kanban-column:hover { transform: scale(1.03) translateY(-7px) !important; box-shadow: 0 25px 50px rgba(0,0,0,0.4); }
.column-header { padding: 1rem 1.25rem; display: flex; align-items: center; flex-shrink: 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1); .column-title { font-size: 1.1rem; font-weight: bold; } }
.column-content { padding: 0.5rem 1rem 1rem 1rem; flex-grow: 1; min-height: 200px; overflow-y: auto; }
.order-card { cursor: pointer; background-color: rgba(35, 35, 45, 0.8); border-radius: 12px; position: relative; overflow: hidden; border: 1px solid transparent; transition: transform 0.2s ease-out; .card-content { z-index: 2; } .card-border { position: absolute; inset: 0; border-radius: inherit; background: radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(255, 255, 255, 0.2), transparent 40%); opacity: 0; transition: opacity 0.4s; } &:hover .card-border { opacity: 1; } }
.empty-column { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; color: #616161; }
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.2); border-radius: 3px; }
</style>
