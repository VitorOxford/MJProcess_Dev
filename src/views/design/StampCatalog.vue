<template>
  <v-container fluid class="pa-md-6 pa-4">
    <v-toolbar color="transparent" class="mb-4">
      <v-toolbar-title class="font-weight-bold text-h5">
        <v-icon start>mdi-image-multiple-outline</v-icon>
        Catálogo de Estampas
      </v-toolbar-title>
    </v-toolbar>

    <v-row>
      <v-col cols="12" md="4">
        <v-card class="glassmorphism-card pa-4" variant="flat">
          <h3 class="text-h6 font-weight-bold mb-4">Cadastrar Nova Estampa</h3>

          <v-form ref="form" @submit.prevent="submitNewStamp">
            <v-text-field
              v-model="newStamp.name"
              label="Código / Referência da Estampa"
              variant="outlined"
              :rules="[rules.required]"
              autofocus
            ></v-text-field>

            <v-file-input
              v-model="newStamp.file"
              @change="handleFileChange"
              label="Arquivo da Imagem (.png, .jpg)"
              variant="outlined"
              accept="image/png, image/jpeg"
              :rules="[rules.fileRequired]"
            ></v-file-input>

            <v-img
              v-if="imagePreviewUrl"
              :src="imagePreviewUrl"
              max-height="150"
              contain
              class="rounded border my-4"
            ></v-img>

            <v-btn
              :loading="isSubmitting"
              type="submit"
              color="primary"
              block
              size="large"
              class="mt-2"
            >
              <v-icon start>mdi-content-save</v-icon>
              Salvar Nova Estampa
            </v-btn>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" md="8">
        <v-card class="glassmorphism-card" variant="flat">
          <v-data-table
            :headers="headers"
            :items="stampLibrary"
            :loading="loadingStamps"
            class="bg-transparent"
            item-value="id"
            :search="search"
          >
            <template v-slot:top>
              <v-text-field
                v-model="search"
                label="Buscar estampa..."
                class="pa-4"
                variant="outlined"
                density="compact"
                hide-details
              ></v-text-field>
            </template>
            <template v-slot:item.image_url="{ item }">
              <v-avatar class="my-2">
                <v-img :src="item.image_url" cover></v-img>
              </v-avatar>
            </template>
              <template v-slot:item.actions="{ item }">
                <v-btn icon="mdi-delete-outline" variant="text" color="error" @click="deleteStamp(item)"></v-btn>
              </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { supabase } from '@/api/supabase';
import { gestaoApi } from '@/api/gestaoClick';
import type { VForm } from 'vuetify/components';

type StampLibraryItem = {
  id: number;
  gestao_click_service_id: string;
  name: string;
  image_url: string;
};

const form = ref<VForm | null>(null);
const isSubmitting = ref(false);
const loadingStamps = ref(true);
const search = ref('');
const stampLibrary = ref<StampLibraryItem[]>([]);
const imagePreviewUrl = ref<string | null>(null);

const newStamp = reactive<{ name: string; file: File | null }>({
  name: '',
  file: null,
});

const snackbar = reactive({ show: false, text: '', color: '' });

const headers = [
  { title: 'Preview', key: 'image_url', sortable: false },
  { title: 'Nome / Referência', key: 'name' },
  { title: 'ID do Serviço (Gestão Click)', key: 'gestao_click_service_id' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' }
];

const rules = {
  required: (v: any) => !!v || 'Campo obrigatório.',
  fileRequired: (v: File | null) => !!v || 'É obrigatório selecionar um arquivo.',
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;

  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value);
  }

  if (target.files && target.files[0]) {
    const file = target.files[0];
    newStamp.file = file;
    imagePreviewUrl.value = URL.createObjectURL(file);
  } else {
    newStamp.file = null;
    imagePreviewUrl.value = null;
  }
};

const fetchStamps = async () => {
  loadingStamps.value = true;
  try {
    const { data, error } = await supabase.from('stamp_library').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    stampLibrary.value = data || [];
  } catch (err: any) {
    showSnackbarMessage(`Erro ao carregar estampas: ${err.message}`, 'error');
  } finally {
    loadingStamps.value = false;
  }
};

const submitNewStamp = async () => {
  // MUDANÇA 3: Trava de segurança para impedir re-envio
  if (isSubmitting.value) return;

  if (!form.value) return;
  const { valid } = await form.value.validate();
  if (!valid) return;

  const file = newStamp.file;
  if (!file) {
    showSnackbarMessage('Por favor, selecione um arquivo de imagem.', 'error');
    return;
  }

  isSubmitting.value = true; // Ativa a trava
  try {
    const newService = await gestaoApi.cadastrarServico(newStamp.name);

    const filePath = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('stamp-library').upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data: publicUrlData } = supabase.storage.from('stamp-library').getPublicUrl(filePath);

    const { error: insertError } = await supabase.from('stamp_library').insert({
      gestao_click_service_id: newService.id,
      name: newStamp.name,
      image_url: publicUrlData.publicUrl,
    });
    if (insertError) throw insertError;

    showSnackbarMessage('Estampa cadastrada com sucesso!', 'success');
    await fetchStamps();
    form.value.reset();
    newStamp.file = null;
    imagePreviewUrl.value = null;

  } catch (err: any) {
    showSnackbarMessage(`Erro: ${err.message}`, 'error');
  } finally {
    isSubmitting.value = false; // Libera a trava
  }
};

const deleteStamp = async (item: StampLibraryItem) => {
    if(!confirm(`Tem certeza que deseja apagar a estampa "${item.name}"? Esta ação não pode ser desfeita.`)) return;

    try {
        const filePath = item.image_url.split('/stamp-library/')[1];
        if (filePath) {
            const { error: storageError } = await supabase.storage.from('stamp-library').remove([filePath]);
            if (storageError) throw storageError;
        }

        const { error: dbError } = await supabase.from('stamp_library').delete().eq('id', item.id);
        if (dbError) throw dbError;

        showSnackbarMessage('Estampa removida com sucesso.', 'success');
        await fetchStamps();
    } catch (err: any) {
        showSnackbarMessage(`Erro ao remover estampa: ${err.message}`, 'error');
    }
}

const showSnackbarMessage = (text: string, color: string) => {
  snackbar.text = text;
  snackbar.color = color;
  snackbar.show = true;
};

onMounted(fetchStamps);
</script>

<style scoped lang="scss">
.glassmorphism-card {
  background-color: rgba(30, 30, 35, 0.7);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}
</style>
