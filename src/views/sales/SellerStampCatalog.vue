<template>
  <v-container fluid class="stamp-catalog-container pa-md-6 pa-4">
    <div class="catalog-header">
      <div class="text-center">
        <h1 class="text-h4 font-weight-bold">Catálogo de Estampas</h1>
        <p class="text-medium-emphasis mt-1">Navegue e pesquise em todas as estampas disponíveis.</p>
      </div>
      <v-text-field
        v-model="search"
        placeholder="Buscar por nome ou ID..."
        variant="solo-filled"
        flat
        density="comfortable"
        prepend-inner-icon="mdi-magnify"
        hide-details
        rounded="lg"
        class="mt-6 mx-auto search-bar"
      />
    </div>

    <div v-if="activeFolder" class="folder-header">
      <v-btn @click="activeFolder = null" variant="text" size="small" class="back-button">
        <v-icon start>mdi-arrow-left</v-icon>
        Voltar
      </v-btn>
      <h2 class="text-h5 font-weight-bold">{{ activeFolder.name }}</h2>
    </div>
    <v-divider v-if="activeFolder" class="mb-6"></v-divider>

    <div class="content-area">
      <div v-if="loadingStamps" class="loading-state">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      </div>

      <div v-else-if="!activeFolder">
        <v-row v-if="filteredFolders.length > 0">
          <v-col v-for="folder in filteredFolders" :key="folder.id" cols="12" sm="6" md="4" lg="3">
            <StampFolderCard
              :folder="folder"
              :stamp-count="getStampsInFolder(folder.id).length"
              @click="activeFolder = folder"
            />
          </v-col>
        </v-row>
        <div v-if="unassignedStamps.length > 0" class="mt-8">
          <v-divider class="mb-6"></v-divider>
          <h2 class="text-h5 font-weight-bold mb-4">Estampas sem Pasta</h2>
          <v-row>
            <v-col v-for="item in unassignedStamps" :key="item.id" cols="6" sm="4" md="3" lg="2">
              <StampCard :stamp="item" readonly />
            </v-col>
          </v-row>
        </div>
      </div>

      <div v-else>
        <v-row>
          <v-col v-for="item in filteredStampsInFolder" :key="item.id" cols="6" sm="4" md="3" lg="2">
            <StampCard :stamp="item" readonly />
          </v-col>
        </v-row>
      </div>

      <div v-if="!loadingStamps && filteredStamps.length === 0 && filteredFolders.length === 0" class="empty-state">
        <v-icon size="64" class="mb-2">mdi-image-off-outline</v-icon>
        <p>Nenhuma estampa encontrada.</p>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { supabase } from '@/api/supabase';
import StampFolderCard from '@/components/admin/StampFolderCard.vue';
import StampCard from '@/components/admin/StampCard.vue';

type Stamp = { id: number; name: string; image_url: string; folder_id: number | null; is_approved_for_sale: boolean; gestao_click_service_id: string; };
type Folder = { id: number; name: string; };

const loadingStamps = ref(true);
const search = ref('');
const allStamps = ref<Stamp[]>([]);
const folders = ref<Folder[]>([]);
const activeFolder = ref<Folder | null>(null);

const filteredStamps = computed(() => {
  if (!search.value) return allStamps.value;
  const q = search.value.toLowerCase();
  return allStamps.value.filter(s => s.name.toLowerCase().includes(q) || s.gestao_click_service_id.toString().includes(q));
});

const filteredFolders = computed(() => {
  if (!search.value) return folders.value;
  const q = search.value.toLowerCase();
  return folders.value.filter(f => f.name.toLowerCase().includes(q));
});

const getStampsInFolder = (folderId: number) => allStamps.value.filter(s => s.folder_id === folderId);

const filteredStampsInFolder = computed(() => {
  if (!activeFolder.value) return [];
  return filteredStamps.value.filter(s => s.folder_id === activeFolder.value!.id);
});

const unassignedStamps = computed(() => filteredStamps.value.filter(s => s.folder_id === null));


const fetchData = async () => {
  loadingStamps.value = true;
  try {
    const [stampsRes, foldersRes] = await Promise.all([
      supabase.from('stamp_library').select('*').order('created_at', { ascending: false }),
      supabase.from('stamp_folders').select('*').order('name')
    ]);
    if (stampsRes.error) throw stampsRes.error;
    if (foldersRes.error) throw foldersRes.error;
    allStamps.value = stampsRes.data || [];
    folders.value = foldersRes.data || [];
  } finally {
    loadingStamps.value = false;
  }
};

onMounted(fetchData);
</script>

<style scoped lang="scss">
.stamp-catalog-container { display: flex; flex-direction: column; }
.catalog-header { text-align: center; margin-bottom: 2rem; }
.search-bar { max-width: 600px; }
.folder-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0 0.5rem;
  .back-button { color: #a0a0a0; }
}
.content-area { flex-grow: 1; }
.empty-state, .loading-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 4rem;
  color: #757575;
  font-style: italic;
  min-height: 300px;
}
</style>
