<template>
  <v-container fluid class="pa-md-6 pa-4">
    <v-toolbar color="transparent" class="mb-4 px-0">
      <v-toolbar-title class="font-weight-bold text-h4 d-flex align-center">
        <v-icon start size="36" color="primary">mdi-list-status</v-icon>
        Acompanhamento de Pedidos
      </v-toolbar-title>
    </v-toolbar>

    <div v-if="loading" class="text-center py-16">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-4">Carregando pedidos em andamento...</p>
    </div>

    <v-alert v-else-if="activeOrders.length === 0" type="success" variant="tonal" class="mx-auto" max-width="600">
       Não há nenhum pedido ativo no momento.
    </v-alert>

    <v-card v-else class="main-card" variant="flat">
      <v-data-table
        :headers="headers"
        :items="activeOrders"
        item-value="id"
        class="bg-transparent"
        v-model:expanded="expanded"
        show-expand
        items-per-page="15"
      >
        <template v-slot:item.status="{ value }">
            <v-chip size="small" :color="statusColorMap[value]" label variant="tonal" class="font-weight-bold">
                {{ statusDisplayMap[value] || value }}
            </v-chip>
        </template>

        <template v-slot:item.total_items="{ item }">
          <span v-if="item.is_launch">{{ item.order_items.length }} itens</span>
          <span v-else>Pedido Único</span>
        </template>

        <template v-slot:item.data-table-expand="{ toggleExpand, isExpanded, item }">
            <v-btn
                v-if="item.is_launch"
                icon
                variant="text"
                :class="{'v-data-table__expand-icon--expanded': isExpanded(item)}"
                @click="toggleExpand(item)"
            >
                <v-icon>mdi-chevron-down</v-icon>
            </v-btn>
        </template>

        <template v-slot:expanded-row="{ columns, item }">
          <tr v-if="item.is_launch">
            <td :colspan="columns.length" class="pa-0">
              <div class="expanded-content">
                <div class="text-subtitle-1 font-weight-bold mb-2">Itens do Lançamento</div>
                <div v-for="order_item in item.order_items" :key="order_item.id" class="item-row">
                  <div class="item-details">
                    <v-img :src="order_item.stamp_image_url" class="item-thumbnail" cover></v-img>
                    <div>
                      <div class="font-weight-bold">{{ order_item.stamp_ref }}</div>
                      <div class="text-caption">{{ order_item.fabric_type }} - {{ order_item.quantity_meters }}m</div>
                    </div>
                  </div>
                  <div class="item-status-and-actions">
                    <v-chip
                        size="small"
                        :color="statusColorMap[order_item.status] || 'grey'"
                        label
                        variant="tonal"
                        class="font-weight-bold"
                    >
                      {{ statusDisplayMap[order_item.status] || order_item.status }}
                    </v-chip>

                    <v-btn
                      v-if="order_item.is_op_generated"
                      color="info"
                      variant="outlined"
                      size="small"
                      class="ml-4"
                      @click="generatePdf(order_item)"
                    >
                      <v-icon start>mdi-file-pdf-box</v-icon>
                      Gerar OP
                    </v-btn>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { supabase } from '@/api/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// Importe uma biblioteca de PDF, como jsPDF
import jsPDF from 'jspdf';

// --- TYPES ---
type OrderItem = {
  id: string; fabric_type: string; stamp_ref: string; quantity_meters: number;
  stamp_image_url: string; status: string; is_op_generated: boolean;
};
type Order = {
  id: string; customer_name: string; created_at: string; status: string;
  is_launch: boolean;
  created_by: { full_name: string };
  order_items: OrderItem[];
};

// --- STATE ---
const loading = ref(true);
const activeOrders = ref<Order[]>([]);
const expanded = ref([]);

// --- DATA & COMPUTED ---
const headers = [
  { title: 'Cliente', key: 'customer_name', sortable: true },
  { title: 'Vendedor', key: 'created_by.full_name' },
  { title: 'Tipo', key: 'total_items', sortable: false },
  { title: 'Status Geral', key: 'status' },
  { title: '', key: 'data-table-expand', align: 'end' },
];

const statusDisplayMap: Record<string, string> = {
    design_pending: 'No Design',
    customer_approval: 'Aprovação Vendedor',
    approved_by_designer: 'Aprovado (Designer)',
    approved_by_seller: 'Aprovado (Vendedor)',
    production_queue: 'Fila de Produção',
    in_printing: 'Em Impressão',
    in_cutting: 'Em Corte',
    completed: 'Finalizado',
    pending_stock: 'Aguardando Estoque'
};
const statusColorMap: Record<string, string> = {
    design_pending: 'blue-grey',
    customer_approval: 'orange',
    approved_by_designer: 'teal',
    approved_by_seller: 'green',
    production_queue: 'grey',
    in_printing: 'blue',
    in_cutting: 'purple',
    completed: 'success',
    pending_stock: 'error'
};

// --- METHODS ---
const fetchActiveOrders = async () => {
  loading.value = true;
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, customer_name, created_at, status, is_launch,
        created_by:profiles!created_by(full_name),
        order_items(*)
      `)
      .not('status', 'eq', 'completed') // Pega todos que não estão completos
      .order('created_at', { ascending: false });

    if (error) throw error;
    activeOrders.value = data || [];
  } catch (err) {
    console.error("Erro ao buscar pedidos:", err);
  } finally {
    loading.value = false;
  }
};

const generatePdf = (item: OrderItem) => {
  // Lógica de geração de PDF
  const doc = new jsPDF();
  const parentOrder = activeOrders.value.find(o => o.order_items.some(oi => oi.id === item.id));

  doc.setFontSize(18);
  doc.text('Ordem de Produção', 14, 22);

  doc.setFontSize(12);
  doc.text(`Cliente: ${parentOrder?.customer_name}`, 14, 40);
  doc.text(`Vendedor: ${parentOrder?.created_by?.full_name}`, 14, 48);
  doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy')}`, 14, 56);

  doc.line(14, 60, 196, 60); // Linha separadora

  doc.text(`Base (Tecido): ${item.fabric_type}`, 14, 70);
  doc.text(`Quantidade: ${item.quantity_meters}m`, 14, 78);
  doc.text(`Referência da Arte: ${item.stamp_ref}`, 14, 86);

  // A adição da imagem pode ser complexa e requer que a imagem seja acessível (CORS)
  // Esta é uma implementação básica.
  doc.addPage();
  doc.text('Anexo da Arte', 14, 22);
  // doc.addImage(item.stamp_image_url, 'JPEG', 15, 40, 180, 160); // Descomente para tentar adicionar a imagem

  doc.save(`OP-${parentOrder?.customer_name}-${item.stamp_ref}.pdf`);
  alert('Geração de PDF iniciada. Esta funcionalidade pode exigir ajustes de CORS na sua imagem.');
};

const formatDate = (dateString: string) => format(new Date(dateString), 'dd/MM/yy', { locale: ptBR });

// --- LIFECYCLE ---
onMounted(fetchActiveOrders);

</script>

<style scoped lang="scss">
.main-card {
  background-color: rgba(25, 25, 30, 0.7);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.expanded-content {
  padding: 16px 24px;
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

.item-status-and-actions {
    display: flex;
    align-items: center;
}
</style>
