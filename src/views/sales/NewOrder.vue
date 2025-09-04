<template>
  <v-container class="py-8">
    <v-card class="glassmorphism-card-order mx-auto" max-width="1200">
      <v-toolbar color="transparent">
        <v-toolbar-title class="font-weight-bold">
          <v-icon start>mdi-plus-box-outline</v-icon>
          Lançar Novo Pedido
        </v-toolbar-title>
        <v-spacer></v-spacer>
        <div class="pa-2 text-right">
          <div class="text-caption text-grey">Próximo Pedido</div>
          <div v-if="loadingNextOrderNumber" class="text-center">
            <v-progress-circular indeterminate size="20" width="2"></v-progress-circular>
          </div>
          <div v-else class="text-h6 font-weight-bold">#{{ String(nextOrderNumber).padStart(4, '0') }}</div>
        </div>
      </v-toolbar>

      <v-stepper v-if="!orderCreatedSuccess" v-model="step" :items="stepperItems" alt-labels class="stepper-transparent">
        <template v-slot:item.1>
          <v-card flat color="transparent" class="pa-md-4">
            <v-card-text>
              <h3 class="text-h6 font-weight-bold mb-6 text-center">Informações do Cliente e Vendedor</h3>
              <v-form ref="step1Form">
                <v-autocomplete
                  v-model="orderHeader.customer_id"
                  v-model:search="clientSearch"
                  :items="clientList"
                  item-title="nome"
                  item-value="id"
                  label="Cliente"
                  variant="outlined"
                  prepend-inner-icon="mdi-account-search-outline"
                  :rules="[rules.required]"
                  class="mb-4"
                  placeholder="Digite para buscar ou cadastre um novo cliente"
                  :loading="isSearchingClients"
                  no-filter
                >
                  <template v-slot:append>
                    <v-tooltip text="Cadastrar Novo Cliente" location="top">
                      <template v-slot:activator="{ props }">
                        <v-btn v-bind="props" icon="mdi-account-plus-outline" variant="text" @click="showClientModal = true"></v-btn>
                      </template>
                    </v-tooltip>
                  </template>
                  <template v-slot:no-data>
                    <v-list-item
                      title="Nenhum cliente encontrado."
                      subtitle="Clique no '+' para cadastrar um novo."
                    ></v-list-item>
                  </template>
                </v-autocomplete>

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
                  @change="handleProofFileChange"
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
              <h3 class="text-h6 font-weight-bold mb-4 text-center">Itens do Pedido</h3>
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
                        <template #prepend>
                          <v-img
                            v-if="item.stamp_image_file_preview"
                            :src="item.stamp_image_file_preview"
                            width="40"
                            height="40"
                            cover
                            class="rounded mr-4"
                          >
                            <template v-slot:placeholder>
                              <div class="d-flex align-center justify-center fill-height">
                                <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                              </div>
                            </template>
                          </v-img>
                          <v-icon v-else class="mr-4" size="40" color="grey-darken-1">mdi-image-multiple-outline</v-icon>
                        </template>
                        <v-list-item-title class="font-weight-bold d-flex align-center">
                          {{ item.stamp_ref || 'Novo Item' }}
                          <v-chip
                            v-if="item.design_tag"
                            :color="tagColorMap[item.design_tag]"
                            size="x-small"
                            class="ml-2"
                            label
                          >
                            {{ item.design_tag }}
                          </v-chip>
                        </v-list-item-title>
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
                              :items="gestaoClickProducts"
                              item-title="nome"
                              item-value="nome"
                              label="Produto (Base)"
                              variant="outlined"
                              density="compact"
                              :loading="loadingGestaoClickProducts"
                              :rules="[rules.required]"
                            >
                              <template v-slot:item="{ props, item }">
                                <v-list-item v-bind="props" :subtitle="`Estoque: ${item.raw.estoque}`"></v-list-item>
                              </template>
                            </v-autocomplete>
                          </v-col>
                          <v-col cols="12" sm="6">
                            <v-autocomplete
                              v-model="editedItem.stamp_ref_id"
                              :items="gestaoClickServices"
                              item-title="nome"
                              item-value="id"
                              label="Serviço (Estampa)"
                              variant="outlined"
                              density="compact"
                              :rules="[rules.required]"
                              :loading="loadingGestaoClickServices"
                            ></v-autocomplete>
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
                            <div v-if="selectedProductStock !== null" class="mt-n2 mb-4 px-2">
                              <div class="d-flex justify-space-between text-caption text-grey">
                                <span v-if="editedItem.quantity_meters > selectedProductStock" class="text-error">
                                  Atenção: Estoque ficará negativo!
                                </span>
                                <span v-else>Uso do estoque disponível:</span>
                                <span>{{ selectedProductStock }}m</span>
                              </div>
                              <v-progress-linear
                                :model-value="((editedItem.quantity_meters || 0) / selectedProductStock) * 100"
                                :color="getStockUsageColor(editedItem.quantity_meters)"
                                height="6"
                                rounded
                              ></v-progress-linear>
                            </div>
                          </v-col>
                          <v-col cols="12" sm="6">
                            <v-file-input
                              v-model="editedItem.stamp_image_file"
                              @change="handleFileChange"
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
                            <label class="v-label text-caption mb-2 d-block">Destino no Design</label>
                            <div class="d-flex ga-2 flex-wrap">
                              <v-btn
                                v-for="tag in (Object.keys(tagColorMap) as Array<keyof typeof tagColorMap>)"
                                :key="tag"
                                :color="tagColorMap[tag]"
                                :variant="editedItem.design_tag === tag ? 'flat' : 'outlined'"
                                size="small"
                                @click="editedItem.design_tag = tag"
                              >
                                {{ tag }}
                              </v-btn>
                            </div>
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
              Enviar Lançamento
            </v-btn>
          </div>
        </template>
      </v-stepper>

      <div v-else class="pa-8 text-center">
        <v-icon size="80" color="success" class="mb-4">mdi-check-circle-outline</v-icon>
        <h2 class="text-h5 font-weight-bold">Pedido #{{ String(createdOrderNumber).padStart(4, '0') }} criado com sucesso!</h2>
        <p class="mt-2 text-medium-emphasis">O pedido foi enviado para a equipe de design e para o sistema de gestão.</p>
        <div class="mt-8">
          <v-btn
            color="primary"
            size="large"
            variant="flat"
            class="mr-4"
            @click="generateAndUploadQuotePdf"
            :loading="isGeneratingPdf"
          >
            <v-icon left>mdi-file-pdf-box</v-icon>
            Gerar e Anexar Orçamento
          </v-btn>
          <v-btn
            size="large"
            variant="tonal"
            @click="resetForm"
          >
            Lançar Novo Pedido
          </v-btn>
        </div>
      </div>

      <v-alert v-if="feedback.message" :type="feedback.type" class="ma-4" closable @click:close="feedback.message = ''">
        {{ feedback.message }}
      </v-alert>
    </v-card>

    <ClientFormModal
      :show="showClientModal"
      @close="showClientModal = false"
      @client-created="handleClientCreated"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive, nextTick, toRaw, watch } from 'vue';
import { supabase } from '@/api/supabase';
import { useUserStore } from '@/stores/user';
import type { VForm } from 'vuetify/components';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ClientFormModal from '@/components/ClientFormModal.vue';
import { gestaoApi } from '@/api/gestaoClick';

// --- Type Definitions ---
type OrderHeader = {
    customer_id: number | null;
    customer_name: string;
    has_down_payment: boolean;
    down_payment_proof_file: File | null;
};
type OrderItem = {
  fabric_type: string | null;
  stamp_ref_id: string | null;
  stamp_ref: string;
  quantity_meters: number | null;
  stamp_image_file: File | null;
  stamp_image_file_preview: string | null;
  notes: string;
  design_tag: 'Desenvolvimento' | 'Alteração' | 'Finalização' | 'Aprovado';
};
type Feedback = { message: string; type: 'success' | 'error'; }
type Client = { id: number; nome: string; }
type GestaoClickProduct = { id: string; nome: string; estoque: number | string; };
type GestaoClickService = { id: string; nome: string; };
type SaleStatus = { id: number; nome: string; };

// --- Component State ---
const userStore = useUserStore();
const step = ref(1);
const isSubmitting = ref(false);
const step1Form = ref<VForm | null>(null);
const itemForm = ref<VForm | null>(null);
const stepperItems = [
  { title: 'Cliente & Vendedor', icon: 'mdi-account-cash' },
  { title: 'Itens do Pedido', icon: 'mdi-format-list-bulleted-square' }
];
const nextOrderNumber = ref<number | null>(null);
const loadingNextOrderNumber = ref(true);
const orderCreatedSuccess = ref(false);
const createdOrderId = ref<string | null>(null);
const createdOrderNumber = ref<number | null>(null);
const isGeneratingPdf = ref(false);

// --- Client Management State ---
const showClientModal = ref(false);
const clientList = ref<Client[]>([]);
const clientSearch = ref('');
const isSearchingClients = ref(false);
let searchTimeout: NodeJS.Timeout;

// --- Gestao Click Data State ---
const gestaoClickProducts = ref<GestaoClickProduct[]>([]);
const loadingGestaoClickProducts = ref(true);
const gestaoClickServices = ref<GestaoClickService[]>([]);
const loadingGestaoClickServices = ref(true);
const saleStatuses = ref<SaleStatus[]>([]);

const tagColorMap = {
  'Desenvolvimento': '#40c4ff',
  'Alteração': '#ffab40',
  'Finalização': '#26A69A',
  'Aprovado': '#4CAF50'
};

const orderHeader = reactive<OrderHeader>({ customer_id: null, customer_name: '', has_down_payment: false, down_payment_proof_file: null });

const createNewItem = (): OrderItem => ({
  fabric_type: null,
  stamp_ref_id: null,
  stamp_ref: '',
  quantity_meters: null,
  stamp_image_file: null,
  stamp_image_file_preview: null,
  notes: '',
  design_tag: 'Desenvolvimento',
});

const orderItems = ref<OrderItem[]>([]);
const editedItem = ref<OrderItem>(createNewItem());
const editedItemIndex = ref<number | null>(null);
const isEditing = computed(() => editedItemIndex.value !== null);

const feedback = reactive<Feedback>({ message: '', type: 'success' });


// --- Validation and Computed Properties ---
const rules = {
  required: (v: any) => !!v || 'Campo obrigatório.',
  positive: (v: number | null) => (v != null && v > 0) || 'O valor deve ser maior que zero.',
};

watch(() => editedItem.value.stamp_ref_id, (serviceId) => {
    if (!serviceId) {
        editedItem.value.stamp_ref = '';
        return;
    }
    const service = gestaoClickServices.value.find(s => s.id === serviceId);
    if (service) {
        editedItem.value.stamp_ref = service.nome;
    }
});

const selectedProductStock = computed(() => {
    if (!editedItem.value.fabric_type) return null;
    const product = gestaoClickProducts.value.find(p => p.nome === editedItem.value.fabric_type);
    return product ? parseFloat(product.estoque as string) : null;
});

const getStockUsageColor = (quantity: number | null) => {
  if (selectedProductStock.value === null || !quantity) return 'primary';
  if (quantity > selectedProductStock.value) return 'error';
  if (quantity > selectedProductStock.value * 0.8) return 'warning';
  return 'success';
}

const isStep1Valid = computed(() => {
  if (!orderHeader.customer_id) return false;
  if (orderHeader.has_down_payment && !orderHeader.down_payment_proof_file) {
    return false;
  }
  return true;
});

const isItemFormValid = computed(() => {
  const item = editedItem.value;
  const hasText = !!item.fabric_type && !!item.stamp_ref_id;
  const hasNumbers = !!item.quantity_meters && item.quantity_meters > 0;
  const hasFile = !!item.stamp_image_file;
  return hasText && hasNumbers && hasFile;
});

// --- API Calls and Data Fetching ---
watch(clientSearch, (newValue) => {
    if (!newValue) { return; }
    isSearchingClients.value = true;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        clientList.value = await gestaoApi.buscarClientes(newValue);
        isSearchingClients.value = false;
    }, 500);
});

const fetchGestaoClickData = async () => {
    loadingGestaoClickProducts.value = true;
    loadingGestaoClickServices.value = true;
    try {
        const [products, services, statuses] = await Promise.all([
            gestaoApi.buscarProdutos(),
            gestaoApi.buscarServicos(),
            gestaoApi.getSituacoesVenda(),
        ]);
        gestaoClickProducts.value = products;
        gestaoClickServices.value = services;
        saleStatuses.value = statuses;
    } catch (error) {
        showFeedback('Não foi possível carregar dados do Gestão Click (Produtos/Serviços).', 'error');
    } finally {
        loadingGestaoClickProducts.value = false;
        loadingGestaoClickServices.value = false;
    }
};

const handleClientCreated = (newClient: Client) => {
  clientList.value.unshift(newClient);
  orderHeader.customer_id = newClient.id;
  showClientModal.value = false;
  showFeedback(`Cliente "${newClient.nome}" cadastrado com sucesso!`, 'success');
};

const fetchNextOrderNumber = async () => {
    loadingNextOrderNumber.value = true;
    try {
        const { data, error } = await supabase.rpc('get_next_order_number');
        if (error) throw error;
        nextOrderNumber.value = data;
    } catch (e) {
        console.error("Erro ao buscar próximo número do pedido:", e);
        nextOrderNumber.value = 0;
    } finally {
        loadingNextOrderNumber.value = false;
    }
};

const uploadFile = async (file: File | Blob, bucket: string, path: string): Promise<string> => {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
};

// --- Form and Stepper Logic ---

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    editedItem.value.stamp_image_file = file;
    // Limpa a URL antiga para evitar memory leak
    if (editedItem.value.stamp_image_file_preview) {
      URL.revokeObjectURL(editedItem.value.stamp_image_file_preview);
    }
    // Cria uma nova URL para o preview
    editedItem.value.stamp_image_file_preview = URL.createObjectURL(file);
  } else {
    editedItem.value.stamp_image_file = null;
    editedItem.value.stamp_image_file_preview = null;
  }
};

const handleProofFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    orderHeader.down_payment_proof_file = target.files[0];
  } else {
    orderHeader.down_payment_proof_file = null;
  }
};

const nextStep = async () => {
  if (step1Form.value) {
    const { valid } = await step1Form.value.validate();
    if (valid && isStep1Valid.value) step.value++;
  }
}

const prepareNewItem = async () => {
  editedItem.value = createNewItem();
  editedItemIndex.value = null;
  await nextTick();
  itemForm.value?.resetValidation();
}

const editItem = (index: number) => {
  editedItemIndex.value = index;
  const itemToEdit = structuredClone(toRaw(orderItems.value[index]));
  editedItem.value = itemToEdit;
}

const removeItem = (index: number) => {
  orderItems.value.splice(index, 1);
  if (editedItemIndex.value === index) {
    prepareNewItem();
  } else if (editedItemIndex.value !== null && editedItemIndex.value > index) {
    editedItemIndex.value--;
  }
}

const saveOrUpdateItem = async () => {
  if (itemForm.value) {
    const { valid } = await itemForm.value.validate();
    if (!valid || !isItemFormValid.value) { // Checagem dupla para garantir
      showFeedback('Por favor, preencha todos os campos obrigatórios, incluindo o anexo.', 'error');
      return;
    }
  }

  const rawItem = toRaw(editedItem.value);
  if (isEditing.value && editedItemIndex.value !== null) {
    orderItems.value[editedItemIndex.value] = structuredClone(rawItem);
  } else {
    orderItems.value.push(structuredClone(rawItem));
  }
  await prepareNewItem();
};

// --- Submission and Reset Logic ---
const sanitizeName = (name: string) => name.replace(/\s/g, '_').replace(/[^\w.\-]/g, '');

const syncOrderWithGestaoClick = async () => {
    if (!orderHeader.customer_id) {
        throw new Error("ID do cliente não encontrado para sincronização.");
    }
    const situacao = saleStatuses.value.find(s => s.nome.toLowerCase() === 'em aberto') || saleStatuses.value[0];
    if (!situacao) {
        throw new Error("Não foi possível encontrar uma situação de venda válida no Gestão Click.");
    }
    const salePayload = {
        cliente_id: orderHeader.customer_id,
        situacao_id: situacao.id,
        produtos: orderItems.value.map(item => {
            const product = gestaoClickProducts.value.find(p => p.nome === item.fabric_type);
            if (!product) throw new Error(`Produto ${item.fabric_type} não encontrado no Gestão Click.`);
            return {
                produto_id: product.id,
                quantidade: item.quantity_meters || 0,
                valor_unitario: "0.00"
            };
        }),
        servicos: orderItems.value.map(item => ({
            servico_id: item.stamp_ref_id!,
            quantidade: 1,
            valor_unitario: "0.00"
        }))
    };
    await gestaoApi.cadastrarVenda(salePayload);
    for (const item of orderItems.value) {
        const product = gestaoClickProducts.value.find(p => p.nome === item.fabric_type);
        if (product) {
            const currentStock = parseFloat(product.estoque as string);
            const quantityUsed = item.quantity_meters || 0;
            const newStock = currentStock - quantityUsed;
            product.estoque = newStock;
            await gestaoApi.atualizarEstoqueProduto(product.id, newStock);
        }
    }
};


const submitLaunch = async () => {
  if (orderItems.value.length === 0) {
    showFeedback('Adicione pelo menos um item ao lançamento.', 'error');
    return;
  }
  isSubmitting.value = true;
  feedback.message = '';
  try {
    const selectedClient = clientList.value.find(c => c.id === orderHeader.customer_id);
    if (!selectedClient) throw new Error("Cliente selecionado não encontrado na lista.");
    await syncOrderWithGestaoClick();
    let proofPublicUrl: string | null = null;
    if (orderHeader.has_down_payment && orderHeader.down_payment_proof_file) {
      const file = orderHeader.down_payment_proof_file;
      const baseName = sanitizeName(file.name);
      const filePath = `proofs/${Date.now()}-${baseName}`;
      proofPublicUrl = await uploadFile(file, 'proofs', filePath);
    }
    const itemsPayload = await Promise.all(orderItems.value.map(async (item, index) => {
        const file = item.stamp_image_file;
        if (!file) throw new Error(`O item "${item.stamp_ref}" está sem uma imagem anexada.`);
        const baseName = sanitizeName(file.name);
        const filePath = `arts/${Date.now()}-item${index}-${baseName}`;
        const publicUrl = await uploadFile(file, 'arts', filePath);
        return {
            fabric_type: item.fabric_type,
            stamp_ref: item.stamp_ref,
            quantity_meters: item.quantity_meters,
            stamp_image_url: publicUrl,
            design_tag: item.design_tag,
            notes: item.notes,
        };
    }));
    const { data: newOrderNumber, error: rpcError } = await supabase.rpc('create_launch_order', {
      p_customer_name: selectedClient.nome,
      p_created_by: userStore.profile?.id,
      p_store_id: userStore.profile?.store_id,
      p_has_down_payment: orderHeader.has_down_payment,
      p_down_payment_proof_url: proofPublicUrl,
      p_order_items: itemsPayload
    });
    if (rpcError) throw rpcError;
    const { data: orderData } = await supabase.from('orders').select('id').eq('order_number', newOrderNumber).single();
    if (orderData) createdOrderId.value = orderData.id;
    createdOrderNumber.value = newOrderNumber;
    orderCreatedSuccess.value = true;
    showFeedback("Pedido criado e sincronizado com sucesso!", "success");
  } catch (error: any) {
    console.error('Erro ao criar lançamento:', error);
    let errorMessage = error.message || 'Erro desconhecido.';
    if (errorMessage.includes('Gestão Click')) {
        errorMessage = `Falha na integração com o sistema de gestão: ${errorMessage}`;
    }
    showFeedback(`Erro ao criar lançamento: ${errorMessage}`, 'error');
  } finally {
    isSubmitting.value = false;
  }
};


const resetForm = () => {
  orderHeader.customer_id = null;
  orderHeader.customer_name = '';
  orderHeader.has_down_payment = false;
  orderHeader.down_payment_proof_file = null;
  clientSearch.value = '';
  clientList.value = [];
  orderItems.value = [];
  prepareNewItem();
  step.value = 1;
  orderCreatedSuccess.value = false;
  createdOrderId.value = null;
  createdOrderNumber.value = null;
  fetchNextOrderNumber();
  fetchGestaoClickData();
};

const showFeedback = (message: string, type: 'success' | 'error') => {
  feedback.message = message;
  feedback.type = type;
};

const formatCurrency = (value: number | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const imageToBase64 = (url: string): Promise<string> => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
});

const generateAndUploadQuotePdf = async () => {
    isGeneratingPdf.value = true;
    try {
        const selectedClient = clientList.value.find(c => c.id === orderHeader.customer_id) || { nome: 'Cliente Desconhecido' };
        const itemDetailsWithPrice = await Promise.all(orderItems.value.map(async (item) => {
            const price = 0;
            const total = (item.quantity_meters || 0) * price;
            return { base: item.fabric_type, estampa: item.stamp_ref, quantidade: `${item.quantity_meters}m`, valorUnit: formatCurrency(price), valorTotal: formatCurrency(total) };
        }));
        const grandTotal = itemDetailsWithPrice.reduce((sum, item) => sum + parseFloat(item.valorTotal.replace('R$', '').replace(/\./g, '').replace(',', '.')), 0);
        const doc = new jsPDF();
        const { width: pageWidth, height: pageHeight } = doc.internal.pageSize;
        const logoUrl = 'https://cdn.shopify.com/s/files/1/0661/4574/6991/files/Sem_nome_1080_x_800_px_1080_x_500_px_1080_x_400_px_1000_x_380_px_da020cf2-2bb9-4dac-8dd3-4548cfd2e5ae.png?v=1756811713';
        const logoBase64 = await imageToBase64(logoUrl);
        const logoProps = doc.getImageProperties(logoBase64);
        const logoWidth = 50;
        const logoHeight = (logoProps.height * logoWidth) / logoProps.width;
        doc.addImage(logoBase64, 'PNG', 15, 12, logoWidth, logoHeight);
        doc.setFontSize(18).setFont('helvetica', 'bold').text(`Pedido #${String(createdOrderNumber.value).padStart(4, '0')}`, pageWidth - 15, 25, { align: 'right' });
        autoTable(doc, {
            startY: 40,
            head: [['CLIENTE', 'VENDEDOR', 'DATA DE EMISSÃO']],
            body: [[selectedClient.nome, userStore.profile?.full_name || 'N/A', format(new Date(), 'dd/MM/yyyy', { locale: ptBR })]],
            theme: 'striped',
        });
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Base', 'Estampa', 'Quantidade', 'Valor Unit.', 'Valor Total']],
            body: itemDetailsWithPrice.map(i => [i.base, i.estampa, i.quantidade, i.valorUnit, i.valorTotal]),
            theme: 'grid',
            foot: [['', '', '', 'Total do Pedido:', formatCurrency(grandTotal)]],
            footStyles: { fontStyle: 'bold', fontSize: 11, halign: 'right' },
            didDrawPage: () => {
                const signatureY = pageHeight - 40;
                doc.setLineWidth(0.5).setDrawColor(100, 100, 100).line(40, signatureY, pageWidth - 40, signatureY);
                doc.setFontSize(10).setTextColor(100).text(`Assinatura do Cliente: ${selectedClient.nome}`, pageWidth / 2, signatureY + 5, { align: 'center' });
            }
        });
        const pdfBlob = doc.output('blob');
        const pdfFileName = `Pedido_${String(createdOrderNumber.value).padStart(4, '0')}_${selectedClient.nome}.pdf`;
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        const pdfPath = `sales_orders/${pdfFileName}`;
        const publicUrl = await uploadFile(pdfBlob, 'sales-orders', pdfPath);
        const { error: updateError } = await supabase.from('orders').update({ sales_order_pdf_url: publicUrl }).eq('id', createdOrderId.value);
        if (updateError) throw updateError;
        showFeedback('Orçamento em PDF gerado, baixado e anexado com sucesso!', 'success');
    } catch (error: any) {
        console.error("Erro ao gerar PDF do orçamento:", error);
        showFeedback(`Erro ao gerar PDF: ${error.message}`, 'error');
    } finally {
        isGeneratingPdf.value = false;
    }
}

// --- Lifecycle Hooks ---
onMounted(() => {
    fetchNextOrderNumber();
    fetchGestaoClickData();
});
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
</style>
