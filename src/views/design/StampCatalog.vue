<template>
  <v-container fluid class="stamp-catalog-container pa-md-6 pa-4">
    <div class="catalog-header">
      <div class="text-center">
        <h1 class="text-h4 font-weight-bold">Catálogo de Estampas</h1>
        <p class="text-medium-emphasis mt-1">Gerencie, organize e encontre suas estampas com facilidade.</p>
      </div>
      <v-text-field
        v-model="search"
        placeholder="Buscar em todas as estampas..."
        variant="solo-filled"
        flat
        density="comfortable"
        prepend-inner-icon="mdi-magnify"
        hide-details
        rounded="lg"
        class="mt-6 mx-auto"
        style="max-width: 600px;"
      />
      <div class="actions-bar">
        <v-btn @click="openStampModal(null)" color="primary" variant="flat" size="large">
          <v-icon start>mdi-plus-box-outline</v-icon>
          Nova Estampa
        </v-btn>
        <v-btn @click="openFolderModal(null)" variant="tonal" size="large">
          <v-icon start>mdi-folder-plus-outline</v-icon>
          Nova Pasta
        </v-btn>
      </div>
    </div>

    <div v-if="activeFolder" class="folder-header">
      <v-btn @click="activeFolder = null" variant="text" size="small" class="back-button">
        <v-icon start>mdi-arrow-left</v-icon>
        Voltar para Pastas
      </v-btn>
      <h2 class="text-h5 font-weight-bold">{{ activeFolder.name }}</h2>
      <v-btn icon="mdi-pencil-outline" variant="text" size="small" @click="openFolderModal(activeFolder)"></v-btn>
    </div>

    <v-divider v-if="activeFolder" class="mb-6"></v-divider>

    <div class="content-area">
      <div v-if="!activeFolder">
        <v-row>
          <v-col
            v-for="folder in filteredFolders"
            :key="folder.id"
            cols="12" sm="6" md="4" lg="3"
          >
            <StampFolderCard
              :folder="folder"
              :stamp-count="getStampsInFolder(folder.id).length"
              @click="activeFolder = folder"
              @delete="deleteFolder"
              @drop-stamp="handleStampDrop"
            />
          </v-col>
        </v-row>
        <div v-if="filteredFolders.length === 0 && !loadingStamps" class="empty-state">
            <p>Nenhuma pasta encontrada.</p>
        </div>
      </div>

      <div v-else>
        <v-row>
          <v-col
            v-for="item in filteredStamps"
            :key="item.id"
            cols="12" sm="4" md="3" xl="2"
          >
            <StampCard :stamp="item" @delete="deleteStamp" />
          </v-col>
        </v-row>
         <div v-if="filteredStamps.length === 0 && !loadingStamps" class="empty-state">
            <p>Esta pasta está vazia.</p>
        </div>
      </div>

       <div v-if="unassignedStamps.length > 0 && !activeFolder" class="mt-8">
          <v-divider class="mb-6"></v-divider>
          <h2 class="text-h5 font-weight-bold mb-4">Estampas sem Pasta</h2>
          <v-row>
            <v-col
              v-for="item in unassignedStamps"
              :key="item.id"
              cols="12" sm="4" md="3" xl="2"
            >
              <StampCard :stamp="item" @delete="deleteStamp" />
            </v-col>
          </v-row>
       </div>
    </div>

    <StampFolderFormModal
      :show="showFolderModal"
      :folder-data="selectedFolder"
      @close="showFolderModal = false"
      @save="handleFolderSave"
    />

    <StampFormModal
      :show="showStampModal"
      :stamp-data="selectedStamp"
      :folders="folders"
      @close="showStampModal = false"
      @save="handleStampSave"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { supabase } from '@/api/supabase';
import StampFolderCard from '@/components/admin/StampFolderCard.vue';
import StampCard from '@/components/admin/StampCard.vue';
import StampFolderFormModal from '@/components/admin/StampFolderFormModal.vue';
import StampFormModal from '@/components/admin/StampFormModal.vue';

type Stamp = { id: number; name: string; image_url: string; folder_id: number | null; };
type Folder = { id: number; name: string; };

const loadingStamps = ref(true);
const search = ref('');
const allStamps = ref<Stamp[]>([]);
const folders = ref<Folder[]>([]);
const activeFolder = ref<Folder | null>(null);

const showFolderModal = ref(false);
const selectedFolder = ref<Folder | null>(null);
const showStampModal = ref(false);
const selectedStamp = ref<Stamp | null>(null);

const filteredFolders = computed(() => {
  if (!search.value) return folders.value;
  const q = search.value.toLowerCase();
  return folders.value.filter(f => f.name.toLowerCase().includes(q));
});

const getStampsInFolder = (folderId: number) => {
    return allStamps.value.filter(s => s.folder_id === folderId);
}

const unassignedStamps = computed(() => {
    const stamps = allStamps.value.filter(s => s.folder_id === null);
    if (!search.value) return stamps;
    const q = search.value.toLowerCase();
    return stamps.filter(s => s.name.toLowerCase().includes(q));
});

const filteredStamps = computed(() => {
  const stampsInFolder = activeFolder.value
    ? getStampsInFolder(activeFolder.value.id)
    : [];

  if (!search.value) return stampsInFolder;
  const q = search.value.toLowerCase();
  return stampsInFolder.filter(s => s.name.toLowerCase().includes(q));
});

const handleStampDrop = async ({ folderId, stampId }: { folderId: number, stampId: number }) => {
    const stampIndex = allStamps.value.findIndex(s => s.id === stampId);
    if (stampIndex !== -1) {
        allStamps.value[stampIndex].folder_id = folderId;
    }

    try {
        const { error } = await supabase
            .from('stamp_library')
            .update({ folder_id: folderId })
            .eq('id', stampId);
        if (error) {
            console.error("Erro ao mover estampa:", error);
            await fetchData(); // Reverte se houver erro
        }
    } catch (err) {
        console.error("Erro crítico ao mover estampa:", err);
        await fetchData(); // Reverte se houver erro
    }
};

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
  } catch (err) {
    console.error(err);
  } finally {
    loadingStamps.value = false;
  }
};

const openFolderModal = (folder: Folder | null) => {
  selectedFolder.value = folder;
  showFolderModal.value = true;
};

const handleFolderSave = async () => {
    await fetchData();
    showFolderModal.value = false;
};

const deleteFolder = async (folderId: number) => {
    if (confirm('Tem certeza? Todas as estampas nesta pasta ficarão sem pasta.')) {
        await supabase.from('stamp_folders').delete().eq('id', folderId);
        await fetchData();
    }
}

const openStampModal = (stamp: Stamp | null) => {
    selectedStamp.value = stamp;
    showStampModal.value = true;
}

const handleStampSave = async () => {
    await fetchData();
    showStampModal.value = false;
}

const deleteStamp = async (stampId: number) => {
    if (confirm('Tem certeza que deseja apagar esta estampa?')) {
        const stampToDelete = allStamps.value.find(s => s.id === stampId);
        if (stampToDelete) {
            const filePath = stampToDelete.image_url.split('/stamp-library/')[1];
            if (filePath) {
                await supabase.storage.from('stamp-library').remove([filePath]);
            }
        }
        await supabase.from('stamp_library').delete().eq('id', stampId);
        await fetchData();
    }
}

onMounted(fetchData);
</script>

<style scoped lang="scss">
.stamp-catalog-container { display: flex; flex-direction: column; }
.catalog-header { text-align: center; margin-bottom: 2rem; }
.actions-bar { display: flex; justify-content: center; gap: 1rem; margin-top: 1.5rem; }
.folder-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0 0.5rem;
  .back-button { color: #a0a0a0; }
}
.content-area { flex-grow: 1; }
.empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 4rem;
    color: #757575;
    font-style: italic;
}
</style>
