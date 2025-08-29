<template>
  <v-container class="py-8">
    <v-card class="glassmorphism-card-order mx-auto" max-width="950">
      <v-toolbar color="transparent">
        <v-toolbar-title class="font-weight-bold">
          <v-icon start>mdi-plus-box-outline</v-icon>
          Lançar Novo Pedido
        </v-toolbar-title>
      </v-toolbar>

      <v-stepper v-model="step" :items="stepperItems" alt-labels class="stepper-transparent">
        <template v-slot:item.1>
          <v-card flat color="transparent" class="pa-md-4">
            <v-card-text>
              <h3 class="text-h6 font-weight-bold mb-6 text-center">Informações do Cliente e Vendedor</h3>
              <v-form ref="step1Form">
                <v-text-field
                  v-model="orderHeader.customer_name"
                  label="Nome do Cliente"
                  variant="outlined"
                  prepend-inner-icon="mdi-account-outline"
                  :rules="[rules.required]"
                  class="mb-4"
                ></v-text-field>

                <v-text-field
                  :model-value="userStore.profile?.full_name"
                  label="Vendedor"
                  variant="outlined"
                  prepend-inner-icon="mdi-account-tie-outline"
                  readonly
                  class="mb-4"
                ></v-text-field>

                <v-switch
                  v-model="orderHeader.has_down_payment"
                  label="Houve pagamento de entrada (sinal)?"
                  color="primary"
                  inset
                ></v-switch>

                <v-file-input
                  v-if="orderHeader.has_down_payment"
                  v-model="orderHeader.down_payment_proof_file"
                  label="Comprovante de Entrada"
                  variant="outlined"
                  prepend-icon="mdi-upload"
                  :rules="[rules.requiredFile]"
                  accept="image/*,.pdf"
                  class="mt-4"
                ></v-file-input>
              </v-form>
            </v-card-text>
          </v-card>
        </template>

        <template v-slot:item.2>
          <v-card flat color="transparent">
            <v-card-text>
              <h3 class="text-h6 font-weight-bold mb-4 text-center">Itens do Lançamento</h3>
              <v-form ref="step2Form">
                <div v-for="(item, index) in orderItems" :key="index" class="item-card">
                  <div class="item-header">
                    <span class="font-weight-bold">Item {{ index + 1 }}</span>
                    <v-btn
                      v-if="orderItems.length > 1"
                      icon="mdi-delete-outline"
                      variant="text"
                      size="small"
                      color="error"
                      @click="removeItem(index)"
                    ></v-btn>
                  </div>

                  <v-row>
                    <v-col cols="12" md="6">
                      <v-autocomplete
                        v-model="item.fabric_type"
                        :items="stockItems"
                        item-title="fabric_type"
                        item-value="fabric_type"
                        label="Produto (Base)"
                        variant="outlined"
                        density="compact"
                        :loading="loadingStock"
                        :rules="[rules.required]"
                      >
                        <template v-slot:item="{ props, item: stockItem }">
                          <v-list-item v-bind="props" :subtitle="`Disponível: ${stockItem.raw.available_meters}m`"></v-list-item>
                        </template>
                      </v-autocomplete>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="item.stamp_ref"
                        label="Serviço (Estampa - Referência)"
                        variant="outlined"
                        density="compact"
                        :rules="[rules.required]"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" md="6">
                       <v-text-field
                        v-model.number="item.quantity_meters"
                        label="Metragem (metros)"
                        type="number"
                        variant="outlined"
                        density="compact"
                        :rules="[rules.required, rules.positive]"
                        :disabled="!item.fabric_type"
                      ></v-text-field>
                      <div v-if="getStockForItem(item)" class="mt-n2 mb-4 px-2">
                          <div class="d-flex justify-space-between text-caption text-grey">
                              <span v-if="item.quantity_meters > getStockForItem(item).available_meters" class="text-error">
                                  Atenção: Estoque ficará negativo!
                              </span>
                              <span v-else>Uso do estoque disponível:</span>
                              <span>{{ getStockForItem(item).available_meters }}m</span>
                          </div>
                         <v-progress-linear
                              :model-value="(item.quantity_meters / getStockForItem(item).available_meters) * 100"
                              :color="getStockUsageColor(item)"
                              height="6"
                              rounded
                         ></v-progress-linear>
                      </div>
                    </v-col>
                     <v-col cols="12" md="6">
                      <v-file-input
                        v-model="item.stamp_image_file"
                        label="Anexar Estampa"
                        variant="outlined"
                        density="compact"
                        prepend-icon=""
                        prepend-inner-icon="mdi-image-plus-outline"
                        :rules="[rules.requiredFile]"
                        accept="image/*,.pdf,.cdr,.ai"
                      ></v-file-input>
                    </v-col>
                    <v-col cols="12">
                       <v-textarea
                          v-model="item.notes"
                          label="Observações para este item"
                          variant="outlined"
                          rows="2"
                          density="compact"
                        ></v-textarea>
                    </v-col>
                     <v-col cols="12">
                       <v-btn-toggle
                          v-model="item.design_tag"
                          color="primary"
                          variant="outlined"
                          divided
                          mandatory
                          class="w-100"
                        >
                          <v-btn value="Desenvolvimento" class="flex-grow-1">Desenvolvimento</v-btn>
                          <v-btn value="Alteração" class="flex-grow-1">Alteração</v-btn>
                          <v-btn value="Finalização" class="flex-grow-1">Finalização</v-btn>
                        </v-btn-toggle>
                    </v-col>
                  </v-row>
                </div>
              </v-form>

              <v-btn block color="primary" variant="tonal" class="mt-4" @click="addItem">
                <v-icon start>mdi-plus</v-icon>
                Adicionar outro item ao lançamento
              </v-btn>

            </v-card-text>
          </v-card>
        </template>

        <template v-slot:actions>
            <div class="d-flex w-100 pa-4">
                <v-btn v-if="step > 1" @click="step--" variant="tonal">Voltar</v-btn>
                <v-spacer></v-spacer>
                <v-btn v-if="step < 2" @click="nextStep" :disabled="!isStep1Valid">Continuar</v-btn>
                <v-btn v-else @click="submitLaunch" :loading="isSubmitting" :disabled="!isStep2Valid" color="primary" variant="flat">
                    <v-icon left>mdi-rocket-launch</v-icon>
                    Enviar para o Design
                </v-btn>
            </div>
        </template>
      </v-stepper>

       <v-alert v-if="feedback.message" :type="feedback.type" class="ma-4" closable @click:close="feedback.message = ''">
            {{ feedback.message }}
        </v-alert>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue';
import { supabase } from '@/api/supabase';
import { useUserStore } from '@/stores/user';
import type { VForm } from 'vuetify/components';

// --- TYPES ---
type StockItem = {
  fabric_type: string;
  available_meters: number;
};
type OrderHeader = {
  customer_name: string;
  has_down_payment: boolean;
  down_payment_proof_file: File[] | null;
};
type OrderItem = {
  fabric_type: string | null;
  stamp_ref: string;
  quantity_meters: number | null;
  stamp_image_file: File[];
  notes: string;
  design_tag: 'Desenvolvimento' | 'Alteração' | 'Finalização';
};
type Feedback = {
    message: string;
    type: 'success' | 'error';
}

// --- STATE ---
const userStore = useUserStore();
const step = ref(1);
const stockItems = ref<StockItem[]>([]);
const loadingStock = ref(true);
const isSubmitting = ref(false);

const step1Form = ref<VForm | null>(null);
const step2Form = ref<VForm | null>(null);

const stepperItems = [
    { title: 'Cliente & Vendedor', icon: 'mdi-account-cash' },
    { title: 'Itens do Pedido', icon: 'mdi-format-list-bulleted-square' },
];

const orderHeader = reactive<OrderHeader>({
  customer_name: '',
  has_down_payment: false,
  down_payment_proof_file: null,
});

const createNewItem = (): OrderItem => ({
  fabric_type: null,
  stamp_ref: '',
  quantity_meters: null,
  stamp_image_file: [],
  notes: '',
  design_tag: 'Desenvolvimento',
});

const orderItems = ref<OrderItem[]>([createNewItem()]);
const feedback = reactive<Feedback>({ message: '', type: 'success' });

// --- RULES & VALIDATION ---
const rules = {
  required: (v: any) => !!v || 'Campo obrigatório.',
  requiredFile: (v: File[] | null) => (v && v.length > 0) || 'Arquivo é obrigatório.',
  positive: (v: number | null) => (v != null && v > 0) || 'O valor deve ser maior que zero.',
};

// CORREÇÃO: Validação separada por etapa para maior clareza
const isStep1Valid = computed(() => {
    if (!orderHeader.customer_name?.trim()) return false;
    if (orderHeader.has_down_payment && (!orderHeader.down_payment_proof_file || orderHeader.down_payment_proof_file.length === 0)) {
        return false;
    }
    return true;
});

const isStep2Valid = computed(() => {
    return orderItems.value.every(item =>
        item.fabric_type &&
        item.stamp_ref.trim() &&
        item.quantity_meters && item.quantity_meters > 0 &&
        item.stamp_image_file && item.stamp_image_file.length > 0 &&
        item.design_tag
    );
});

const nextStep = async () => {
    if (step1Form.value) {
        const { valid } = await step1Form.value.validate();
        if (valid) {
            step.value++;
        }
    }
}

// --- METHODS ---
const getStockForItem = (item: OrderItem): StockItem | undefined => {
    return stockItems.value.find(s => s.fabric_type === item.fabric_type);
}

const getStockUsageColor = (item: OrderItem): string => {
    const stockItem = getStockForItem(item);
    if (!stockItem || !item.quantity_meters) return 'primary';
    if (item.quantity_meters > stockItem.available_meters) return 'error';
    if (item.quantity_meters > stockItem.available_meters * 0.8) return 'warning';
    return 'success';
}

const addItem = () => orderItems.value.push(createNewItem());
const removeItem = (index: number) => orderItems.value.splice(index, 1);

const fetchStock = async () => {
  loadingStock.value = true;
  try {
    // CORREÇÃO: Buscar todos os dados do estoque
    const { data, error } = await supabase.from('stock').select('*').order('fabric_type');
    if (error) throw error;
    stockItems.value = data || [];
  } catch (error) {
    showFeedback('Não foi possível carregar os materiais do estoque.', 'error');
  } finally {
    loadingStock.value = false;
  }
};

const showFeedback = (message: string, type: 'success' | 'error') => {
    feedback.message = message;
    feedback.type = type;
}

const uploadFile = async (file: File, bucket: string, path: string): Promise<string> => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, { upsert: true });
    if (error) throw error;
    return data.path;
}

const submitLaunch = async () => {
  if (step2Form.value) {
    const { valid } = await step2Form.value.validate();
    if (!valid) {
      showFeedback('Por favor, preencha todos os campos obrigatórios dos itens.', 'error');
      return;
    }
  }

  isSubmitting.value = true;
  feedback.message = '';

  try {
    let proofPublicUrl: string | null = null;
    if (orderHeader.has_down_payment && orderHeader.down_payment_proof_file?.[0]) {
      const file = orderHeader.down_payment_proof_file[0];
      const filePath = `proofs/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
      const path = await uploadFile(file, 'proofs', filePath);
      proofPublicUrl = supabase.storage.from('proofs').getPublicUrl(path).data.publicUrl;
    }

    const itemsPayload = await Promise.all(orderItems.value.map(async (item, index) => {
        const file = item.stamp_image_file![0];
        const filePath = `arts/${Date.now()}-item${index}-${file.name.replace(/\s/g, '_')}`;
        const path = await uploadFile(file, 'arts', filePath);
        const publicUrl = supabase.storage.from('arts').getPublicUrl(path).data.publicUrl;

        return {
            fabric_type: item.fabric_type, stamp_ref: item.stamp_ref,
            quantity_meters: item.quantity_meters, stamp_image_url: publicUrl,
            design_tag: item.design_tag, notes: item.notes,
        };
    }));

    const { error: rpcError } = await supabase.rpc('create_launch_order', {
        p_customer_name: orderHeader.customer_name,
        p_created_by: userStore.profile?.id, p_store_id: userStore.profile?.store_id,
        p_has_down_payment: orderHeader.has_down_payment,
        p_down_payment_proof_url: proofPublicUrl,
        p_order_items: itemsPayload
    });

    if (rpcError) throw rpcError;

    showFeedback('Lançamento enviado para o design com sucesso!', 'success');
    resetForm();

  } catch (error: any) {
    console.error('Erro ao criar lançamento:', error);
    showFeedback(`Erro ao criar lançamento: ${error.message}`, 'error');
  } finally {
    isSubmitting.value = false;
  }
};

const resetForm = () => {
    orderHeader.customer_name = '';
    orderHeader.has_down_payment = false;
    orderHeader.down_payment_proof_file = null;
    orderItems.value = [createNewItem()];
    step.value = 1;
};

// --- LIFECYCLE ---
onMounted(fetchStock);

</script>

<style scoped lang="scss">
/* Estilos mantidos da versão anterior */
.glassmorphism-card-order {
  backdrop-filter: blur(15px);
  background-color: rgba(25, 25, 30, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}
.stepper-transparent {
    background-color: transparent !important;
    box-shadow: none !important;
    :deep(.v-stepper-item__title) { color: rgba(255, 255, 255, 0.8) !important; }
    :deep(.v-stepper-item--selected .v-stepper-item__title) { color: white !important; }
    :deep(.v-sheet) { background-color: transparent !important; box-shadow: none !important; }
}
.item-card {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background-color: rgba(255, 255, 255, 0.05);
}
.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.v-btn-toggle {
  display: flex;
  .v-btn { flex: 1 1 0; }
}
</style>
