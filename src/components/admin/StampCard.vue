<template>
    <v-card
      class="stamp-card"
      variant="flat"
      draggable="true"
      @dragstart="onDragStart"
      @click="openImageModal"
    >
        <v-img
          :src="thumbnailUrl"
          @error="onImageError"
          aspect-ratio="1"
          cover
          class="stamp-image"
        >
            <template v-slot:placeholder>
                <div class="d-flex align-center justify-center fill-height">
                    <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                </div>
            </template>
        </v-img>

        <div class="card-overlay">
             <v-btn
                icon="mdi-delete-outline"
                variant="flat"
                color="rgba(0,0,0,0.6)"
                size="small"
                class="delete-button"
                @click.stop="$emit('delete', stamp.id)"
            ></v-btn>
        </div>

        <v-card-title class="stamp-title">
            {{ stamp.name }}
        </v-card-title>
    </v-card>

    <ImageModal
      :show="showImageModal"
      :image-url="stamp.image_url"
      :file-name="stamp.name"
      @close="showImageModal = false"
    />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { supabase } from '@/api/supabase';
import ImageModal from '@/components/ImageModal.vue';

const props = defineProps({
    stamp: { type: Object as () => { id: number; name: string; image_url: string; }, required: true }
});

defineEmits(['delete']);

const showImageModal = ref(false);
const thumbnailHasFailed = ref(false);

const openImageModal = () => {
  showImageModal.value = true;
};

// ** NOVO: Função para iniciar o arraste **
const onDragStart = (event: DragEvent) => {
  if (event.dataTransfer) {
    // Anexa o ID da estampa aos dados do evento de arraste
    event.dataTransfer.setData('text/plain', props.stamp.id.toString());
    event.dataTransfer.dropEffect = 'move';
  }
};

const thumbnailUrl = computed(() => {
  if (thumbnailHasFailed.value || !props.stamp.image_url) {
    return props.stamp.image_url || '';
  }
  try {
    const url = new URL(props.stamp.image_url);
    const pathParts = url.pathname.split('/stamp-library/');
    if (pathParts.length < 2) return props.stamp.image_url;
    const filePath = decodeURIComponent(pathParts[1]);
    const { data } = supabase.storage
      .from('stamp-library')
      .getPublicUrl(filePath, {
        transform: { width: 250, height: 250, resize: 'contain', quality: 75 },
      });
    return data.publicUrl;
  } catch (e) {
    return props.stamp.image_url;
  }
});

const onImageError = () => {
  if (!thumbnailHasFailed.value) {
    thumbnailHasFailed.value = true;
  }
};
</script>

<style scoped lang="scss">
.stamp-card {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    background-color: rgba(35, 35, 40, 0.9);
    transition: transform 0.2s ease-out;
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: grab;

    &:active {
      cursor: grabbing;
    }

    &:hover {
        transform: translateY(-4px);
        .card-overlay {
            opacity: 1;
        }
    }
}
.stamp-image { transition: transform 0.3s ease; }
.stamp-card:hover .stamp-image { transform: scale(1.05); }
.stamp-title {
    font-size: 0.9rem;
    padding: 8px 12px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background-color: rgba(30, 30, 35, 0.8);
}
.card-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: calc(100% - 40px);
    opacity: 0;
    transition: opacity 0.3s ease;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    padding: 8px;
}
.delete-button { color: white; }
</style>
