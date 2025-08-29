<template>
  <v-container fluid class="pa-md-6 pa-4">
    <v-toolbar color="transparent" class="mb-4 px-0">
      <v-toolbar-title class="font-weight-bold text-h4 d-flex align-center">
        <v-icon start size="36" color="primary">mdi-palette-swatch-outline</v-icon>
        Fluxo de Design
      </v-toolbar-title>
    </v-toolbar>

    <div v-if="loading" class="text-center py-16">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-4">Carregando lançamentos...</p>
    </div>

    <v-alert v-else-if="groupedOrders.length === 0" type="info" variant="tonal" class="mx-auto" max-width="600">
      <template #prepend>
        <v-icon>mdi-emoticon-cool-outline</v-icon>
      </template>
      Não há nenhum pedido na fila de design no momento.
    </v-alert>

    <v-card v-else class="main-card" variant="flat">
      <v-expansion-panels v-model="panel" variant="accordion" multiple>
        <v-expansion-panel v-for="group in groupedOrders" :key="group.tag" :value="group.tag">
          <v-expansion-panel-title class="panel-title">
            <v-icon :color="group.color" class="mr-3">{{ group.icon }}</v-icon>
            {{ group.tag }}
            <v-chip size="small" variant="tonal" class="ml-auto" :color="group.color">{{ group.orders.length }}</v-chip>
          </v-expansion-panel-title>
          <v-expansion-panel-text class="panel-content">
            <v-data-table
              :headers="headers"
              :items="group.orders"
              item-value="id"
              class="bg-transparent"
              v-model:expanded="expanded"
              show-expand
            >
              <template v-slot:item.data-table-expand="{ toggleExpand, isExpanded }">
                  <v-btn
                      icon
                      :class="{'v-data-table__expand-icon--expanded': isExpanded(item)}"
                      @click="toggleExpand(item)"
                  >
                      <v-icon>{{ isExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                  </v-btn>
              </template>
              <template v-slot:item.total_items="{ item }">
                  <v-chip size="small">{{ item.order_items.length }} {{ item.order_items.length > 1 ? 'itens' : 'item' }}</v-chip>
              </template>
              <template v-slot:item.created_at="{ value }">
                  {{ formatDate(value) }}
              </template>

              <template v-slot:expanded-row="{ columns, item }">
                <tr>
                  <td :colspan="columns.length" class="pa-0">
                    <div class="expanded-content">
                      <div v-for="order_item in item.order_items" :key="order_item.id" class="item-row">
                        <div class="item-details">
                          <v-img :src="order_item.stamp_image_url" class="item-thumbnail" cover></v-img>
                          <div>
                            <div class="font-weight-bold">{{ order_item.stamp_ref }}</div>
                            <div class="text-caption">{{ order_item.fabric_type }} - {{ order_item.quantity_meters }}m</div>
                          </div>
                        </div>
                        <div class="item-actions">
                          <v-btn
                            v-if="order_item.design_tag === 'Finalização'"
                            color="success"
                            variant="tonal"
                            size="small"
                            @click="handleDesignerApproval(order_item)"
                          >
                            Aprovar para Produção
                          </v-btn>
                          <v-btn
                            v-else
                            color="orange"
                            variant="tonal"
                            size="small"
                            @click="openUploadModal(item, order_item)"
                          >
                            Enviar para Aprovação
                          </v-btn>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </v-data-table>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card>

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
import { ref, onMounted, computed } from 'vue';
import { supabase } from '@/api/supabase';
import { useUserStore } from '@/stores/user';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import FileUploadModal from '@/components/FileUploadModal.vue';

// --- TYPES ---
type OrderItem = {
  id: string;
  fabric_type: string;
  stamp_ref: string;
  quantity_meters: number;
  stamp_image_url: string;
  design_tag: 'Desenvolvimento' | 'Alteração' | 'Finalização';
  status: string;
};
type Order = {
  id: string;
  customer_name: string;
  created_at: string;
  created_by: { full_name: string };
  order_items: OrderItem[];
};

// --- STATE ---
const loading = ref(true);
const orders = ref<Order[]>([]);
const userStore = useUserStore();
const expanded = ref([]);
const panel = ref(['Desenvolvimento', 'Alteração']); // Painéis abertos por padrão

const showUploadModal = ref(false);
const selectedOrder = ref<Order | null>(null);
const selectedItem = ref<OrderItem | null>(null);
const uploadModalTitle = ref('');

// --- DATA & COMPUTED ---
const headers = [
  { title: 'Cliente', key: 'customer_name' },
  { title: 'Vendedor', key: 'created_by.full_name' },
  { title: 'Itens', key: 'total_items', sortable: false },
  { title: 'Data Lançamento', key: 'created_at' },
  { title: '', key: 'data-table-expand' },
];

const groupedOrders = computed(() => {
    const groups = {
        Desenvolvimento: { tag: 'Desenvolvimento', icon: 'mdi-lightbulb-on-outline', color: 'primary', orders: [] as Order[] },
        Alteração: { tag: 'Alteração', icon: 'mdi-swap-horizontal-bold', color: 'warning', orders: [] as Order[] },
        Finalização: { tag: 'Finalização', icon: 'mdi-flag-checkered', color: 'success', orders: [] as Order[] },
    };

    orders.value.forEach(order => {
        // Um pedido pertence a um grupo se QUALQUER um de seus itens tiver essa tag
        if (order.order_items.some(item => item.design_tag === 'Desenvolvimento' && item.status === 'design_pending')) {
            groups.Desenvolvimento.orders.push(order);
        } else if (order.order_items.some(item => item.design_tag === 'Alteração' && item.status === 'design_pending')) {
            groups.Alteração.orders.push(order);
        } else if (order.order_items.some(item => item.design_tag === 'Finalização' && item.status === 'design_pending')) {
            groups.Finalização.orders.push(order);
        }
    });

    return Object.values(groups);
});

// --- METHODS ---
const fetchDesignOrders = async () => {
  loading.value = true;
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, customer_name, created_at,
        created_by:profiles!created_by(full_name),
        order_items(*)
      `)
      .eq('status', 'design_pending') // Apenas pedidos pai que estão no design
      .order('created_at', { ascending: true });

    if (error) throw error;
    orders.value = data || [];
  } catch (err) {
    console.error("Erro ao buscar pedidos para o design:", err);
  } finally {
    loading.value = false;
  }
};

const openUploadModal = (order: Order, item: OrderItem) => {
    selectedOrder.value = order;
    selectedItem.value = item;
    uploadModalTitle.value = `Enviar "${item.stamp_ref}" para Aprovação`;
    showUploadModal.value = true;
};

const handleUploadSuccess = async (fileUrl: string) => {
    if (!selectedItem.value || !userStore.profile) return;
    await updateItemStatus(selectedItem.value, 'customer_approval', fileUrl);
    showUploadModal.value = false;
};

const handleDesignerApproval = async (item: OrderItem) => {
    // Designer aprova diretamente itens de "Finalização"
    await updateItemStatus(item, 'approved_by_designer');
};

const updateItemStatus = async (item: OrderItem, newStatus: string, fileUrl?: string) => {
    try {
        const { error } = await supabase.rpc('update_order_item_status', {
            p_item_id: item.id,
            p_new_status: newStatus,
            p_final_art_url: fileUrl,
            p_profile_id: userStore.profile?.id
        });
        if (error) throw error;
        // Recarrega os dados para refletir as mudanças
        await fetchDesignOrders();
    } catch (err) {
        console.error("Erro ao atualizar status do item:", err);
    }
};

const formatDate = (dateString: string) => format(new Date(dateString), 'dd/MM/yy HH:mm', { locale: ptBR });

// --- LIFECYCLE ---
onMounted(fetchDesignOrders);

</script>

<style scoped lang="scss">
.main-card {
  background-color: rgba(25, 25, 30, 0.7);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.panel-title {
  font-size: 1.2rem;
  font-weight: bold;
}
.panel-content {
  background-color: rgba(0,0,0,0.2);
}

.expanded-content {
  padding: 16px;
  background-color: rgba(0,0,0,0.25);
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  &:last-child {
    border-bottom: none;
  }
}

.item-details {
  display: flex;
  align-items: center;
  gap: 16px;
}

.item-thumbnail {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
}
</style>
