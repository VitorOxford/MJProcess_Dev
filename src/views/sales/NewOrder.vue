<template>
  <v-container class="py-8">
    <v-card class="glassmorphism-card-order mx-auto" max-width="1200">
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
              <v-row>
                <v-col cols="12" md="5">
                  <v-card class="item-list-card" variant="outlined">
                    <v-list class="bg-transparent">
                      <v-list-subheader>ITENS ADICIONADOS</v-list-subheader>
                      <div v-if="orderItems.length === 0" class="text-center text-grey pa-4">Nenhum item adicionado.</div>
                      <v-list-item
                        v-for="(item, index) in orderItems"
                        :key="index"
                        :active="editedItemIndex === index"
                        @click="editItem(index)"
                      >
                        <v-list-item-title class="font-weight-bold">{{ item.stamp_ref || 'Novo Item' }}</v-list-item-title>
                        <v-list-item-subtitle>{{ item.fabric_type || 'Sem tecido' }} - {{ item.quantity_meters || 0 }}m</v-list-item-subtitle>
                        <template v-slot:append>
                          <v-btn icon="mdi-delete-outline" variant="text" size="small" color="error" @click.stop="removeItem(index)"></v-btn>
                        </template>
                      </v-list-item>
                    </v-list>
                     <v-divider></v-divider>
                    <v-card-actions>
                        <v-btn block variant="tonal" @click="prepareNewItem">
                            <v-icon start>mdi-plus</v-icon> Adicionar Novo Item
                        </v-btn>
                    </v-card-actions>
                  </v-card>
                </v-col>

                <v-col cols="12" md="7">
                   <v-card class="item-form-card" variant="flat">
                    <v-card-title>{{ isEditing ? 'Editando Item' : 'Adicionando Novo Item' }}</v-card-title>
                     <v-card-text>
                       <v-form ref="itemForm">
                          <v-row>
                            <v-col cols="12" sm="6">
                              <v-autocomplete
                                v-model="editedItem.fabric_type"
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
                            <v-col cols="12" sm="6">
                              <v-text-field
                                v-model="editedItem.stamp_ref"
                                label="Serviço (Estampa - Referência)"
                                variant="outlined"
                                density="compact"
                                :rules="[rules.required]"
                              ></v-text-field>
                            </v-col>
                             <v-col cols="12" sm="6">
                               <v-text-field
                                v-model.number="editedItem.quantity_meters"
                                label="Metragem (metros)"
                                type="number"
                                variant="outlined"
                                density="compact"
                                :rules="[rules.required, rules.positive]"
                                :disabled="!editedItem.fabric_type"
                              ></v-text-field>
                              <div v-if="getStockForItem(editedItem)" class="mt-n2 mb-4 px-2">
                                  <div class="d-flex justify-space-between text-caption text-grey">
                                      <span v-if="editedItem.quantity_meters > getStockForItem(editedItem).available_meters" class="text-error">
                                          Atenção: Estoque ficará negativo!
                                      </span>
                                      <span v-else>Uso do estoque disponível:</span>
                                      <span>{{ getStockForItem(editedItem).available_meters }}m</span>
                                  </div>
                                 <v-progress-linear
                                      :model-value="(editedItem.quantity_meters / getStockForItem(editedItem).available_meters) * 100"
                                      :color="getStockUsageColor(editedItem)"
                                      height="6"
                                      rounded
                                 ></v-progress-linear>
                              </div>
                            </v-col>
                             <v-col cols="12" sm="6">
                              <v-file-input
                                v-model="editedItem.stamp_image_file"
                                label="Anexar Estampa"
                                variant="outlined"
                                density="compact"
                                prepend-icon=""
                                prepend-inner-icon="mdi-image-plus-outline"
                                accept="image/*,.pdf,.cdr,.ai"
                              ></v-file-input>
                            </v-col>
                            <v-col cols="12">
                               <v-textarea
                                  v-model="editedItem.notes"
                                  label="Observações para este item"
                                  variant="outlined"
                                  rows="2"
                                  density="compact"
                                ></v-textarea>
                            </v-col>
                             <v-col cols="12">
                               <v-btn-toggle
                                  v-model="editedItem.design_tag"
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
                       </v-form>
                     </v-card-text>
                      <v-card-actions>
                          <v-spacer></v-spacer>
                          <v-btn color="primary" variant="flat" @click="saveOrUpdateItem" :disabled="!isItemFormValid">
                            <v-icon start>{{ isEditing ? 'mdi-content-save' : 'mdi-plus' }}</v-icon>
                            {{ isEditing ? 'Atualizar Item' : 'Adicionar à Lista' }}
                          </v-btn>
                      </v-card-actions>
                   </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </template>

        <template v-slot:actions>
            <div class="d-flex w-100 pa-4">
                <v-btn v-if="step > 1" @click="step--" variant="tonal">Voltar</v-btn>
                <v-spacer></v-spacer>
                <v-btn v-if="step < 2" @click="nextStep" :disabled="!isStep1Valid">Continuar</v-btn>
                <v-btn v-else @click="submitLaunch" :loading="isSubmitting" :disabled="orderItems.length === 0" color="primary" variant="flat">
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
import { ref, onMounted, computed, reactive, nextTick } from 'vue';
import { supabase } from '@/api/supabase';
import { useUserStore } from '@/stores/user';
import type { VForm } from 'vuetify/components';

type StockItem = { fabric_type: string; available_meters: number; };
type OrderHeader = { customer_name: string; has_down_payment: boolean; down_payment_proof_file: File[]; };
type OrderItem = { fabric_type: string | null; stamp_ref: string; quantity_meters: number | null; stamp_image_file: File[]; notes: string; design_tag: 'Desenvolvimento' | 'Alteração' | 'Finalização'; };
type Feedback = { message: string; type: 'success' | 'error'; }

const userStore = useUserStore();
const step = ref(1);
const stockItems = ref<StockItem[]>([]);
const loadingStock = ref(true);
const isSubmitting = ref(false);
const step1Form = ref<VForm | null>(null);
const itemForm = ref<VForm | null>(null);
const stepperItems = [{ title: 'Cliente & Vendedor', icon: 'mdi-account-cash' }, { title: 'Itens do Pedido', icon: 'mdi-format-list-bulleted-square' }];

const orderHeader = reactive<OrderHeader>({ customer_name: '', has_down_payment: false, down_payment_proof_file: [] });

const createNewItem = (): OrderItem => ({
  fabric_type: null, stamp_ref: '', quantity_meters: null,
  stamp_image_file: [], notes: '', design_tag: 'Desenvolvimento',
});

const orderItems = ref<OrderItem[]>([]);
const editedItem = ref<OrderItem>(createNewItem());
const editedItemIndex = ref<number | null>(null);
const isEditing = computed(() => editedItemIndex.value !== null);

const feedback = reactive<Feedback>({ message: '', type: 'success' });

const rules = {
  required: (v: any) => !!v || 'Campo obrigatório.',
  positive: (v: number | null) => (v != null && v > 0) || 'O valor deve ser maior que zero.',
};

const isStep1Valid = computed(() => {
    if (!orderHeader.customer_name?.trim()) return false;
    if (orderHeader.has_down_payment && orderHeader.down_payment_proof_file.length === 0) {
        return false;
    }
    return true;
});

const isItemFormValid = computed(() => {
    const item = editedItem.value;
    if (!item.fabric_type || !item.stamp_ref.trim() || !item.quantity_meters || item.quantity_meters <= 0) return false;
    if (item.stamp_image_file.length === 0) return false;
    return true;
});

const nextStep = async () => {
    if (step1Form.value) {
        const { valid } = await step1Form.value.validate();
        if (valid && isStep1Valid.value) step.value++;
    }
}

const getStockForItem = (item: OrderItem) => stockItems.value.find(s => s.fabric_type === item.fabric_type);
const getStockUsageColor = (item: OrderItem) => {
    const stockItem = getStockForItem(item);
    if (!stockItem || !item.quantity_meters) return 'primary';
    if (item.quantity_meters > stockItem.available_meters) return 'error';
    if (item.quantity_meters > stockItem.available_meters * 0.8) return 'warning';
    return 'success';
}

const prepareNewItem = async () => {
    editedItem.value = createNewItem();
    editedItemIndex.value = null;
    // *** CORREÇÃO DO CAMPO VERMELHO ***
    // Espera o Vue atualizar a tela e SÓ DEPOIS reseta a validação do formulário.
    await nextTick();
    itemForm.value?.resetValidation();
}

const editItem = (index: number) => {
    editedItemIndex.value = index;
    // Copia superficial que preserva o objeto File no array.
    editedItem.value = { ...orderItems.value[index] };
}

const removeItem = (index: number) => {
    orderItems.value.splice(index, 1);
    if (editedItemIndex.value === index) {
        prepareNewItem();
    }
}

const saveOrUpdateItem = async () => {
    const { valid } = await itemForm.value!.validate();
    if (!valid || !isItemFormValid.value) {
        return;
    }

    if (isEditing.value && editedItemIndex.value !== null) {
        orderItems.value[editedItemIndex.value] = { ...editedItem.value };
    } else {
        orderItems.value.push({ ...editedItem.value });
    }
    // Agora o formulário é resetado de forma assíncrona para evitar o bug visual.
    await prepareNewItem();
}

const fetchStock = async () => {
  loadingStock.value = true;
  try {
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
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

const submitLaunch = async () => {
  if (orderItems.value.length === 0) {
      showFeedback('Adicione pelo menos um item ao lançamento.', 'error');
      return;
  }
  isSubmitting.value = true;
  feedback.message = '';

  try {
    let proofPublicUrl: string | null = null;
    if (orderHeader.has_down_payment && orderHeader.down_payment_proof_file[0]) {
      const file = orderHeader.down_payment_proof_file[0];
      const filePath = `proofs/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
      proofPublicUrl = await uploadFile(file, 'proofs', filePath);
    }

    const itemsPayload = await Promise.all(orderItems.value.map(async (item, index) => {
        // Adiciona uma verificação para garantir que o arquivo existe antes de acessá-lo.
        if (!item.stamp_image_file || item.stamp_image_file.length === 0) {
            throw new Error(`O item "${item.stamp_ref}" está sem arquivo de estampa.`);
        }
        const file = item.stamp_image_file[0];
        const filePath = `arts/${Date.now()}-item${index}-${file.name.replace(/\s/g, '_')}`;
        const publicUrl = await uploadFile(file, 'arts', filePath);
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
    showFeedback(`Erro ao criar lançamento: ${error.message || 'Erro desconhecido.'}`, 'error');
  } finally {
    isSubmitting.value = false;
  }
};

const resetForm = () => {
    orderHeader.customer_name = '';
    orderHeader.has_down_payment = false;
    orderHeader.down_payment_proof_file = [];
    orderItems.value = [];
    prepareNewItem();
    step.value = 1;
};

onMounted(fetchStock);

</script>

<style scoped lang="scss">
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
.item-list-card {
    background-color: rgba(255, 255, 255, 0.05);
    height: 100%;
}
.item-form-card {
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
}
.v-btn-toggle {
  display: flex;
  .v-btn { flex: 1 1 0; }
}
</style>
