import json
import os

# CONFIGURACIÓN
INPUT_JSON = 'restaurants_with_real_images.json'  # El archivo con los datos procesados
CHECKPOINT_FILE = 'extract_progress.json'  # El archivo de progreso
OUTPUT_JSON = 'restaurants_with_real_images_final.json'  # Archivo final

# IMAGEN PREDETERMINADA PARA RESTAURANTES SIN IMAGEN
DEFAULT_IMAGE = 'https://media.istockphoto.com/id/116659195/fr/photo/derri%C3%A8re-une-table.jpg?s=612x612&w=0&k=20&c=TtufQGmVTjERoRbvq_6BxSpMsVSvQWHBRmX0JB5S9Xw='

def update_images_with_default():
    """Actualizar los registros que tienen null con la imagen predeterminada"""
    print("=== ACTUALIZANDO IMÁGENES FALTANTES ===")
    print("=" * 50)
    
    # Cargar el archivo de datos
    print("Cargando restaurantes...")
    with open(INPUT_JSON, 'r', encoding='utf-8') as f:
        records = json.load(f)
    
    print(f"Total de registros: {len(records)}")
    
    # Cargar el checkpoint con los resultados
    print("Cargando checkpoint...")
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, 'r') as f:
            checkpoint = json.load(f)
        results = checkpoint.get('results', {})
        print(f"Resultados en checkpoint: {len(results)}")
    else:
        results = {}
        print("No se encontró checkpoint, usando datos del JSON")
    
    # Contadores
    updated_count = 0
    already_have_image = 0
    null_count = 0
    
    # Actualizar registros
    for record in records:
        restaurant_id = str(record['objectID'])
        current_image = record.get('image_url', None)
        
        # Si el registro tiene null o no tiene imagen
        if not current_image or current_image == 'None' or current_image == 'null':
            # Verificar si hay un resultado en el checkpoint
            if restaurant_id in results and results[restaurant_id]:
                # Usar la imagen del checkpoint
                record['image_url'] = results[restaurant_id]
                updated_count += 1
                print(f"  ✅ {record['name']}: Usando imagen del checkpoint")
            else:
                # Usar imagen predeterminada
                record['image_url'] = DEFAULT_IMAGE
                updated_count += 1
                null_count += 1
                print(f"  ⚠️ {record['name']}: Usando imagen predeterminada")
        else:
            already_have_image += 1
            # Si ya tiene imagen, verificar que no sea la original de OpenTable
            # (las imágenes originales tienen el formato https://www.opentable.com/img/restimages/)
            if 'opentable.com/img/restimages' in current_image:
                # Esta es una imagen genérica, la reemplazamos con la predeterminada
                record['image_url'] = DEFAULT_IMAGE
                updated_count += 1
                print(f"  ⚠️ {record['name']}: Imagen genérica reemplazada")
    
    print(f"\n=== RESUMEN ===")
    print(f"✅ Ya tenían imagen: {already_have_image}")
    print(f"🔄 Actualizados: {updated_count}")
    print(f"⚠️ Con imagen predeterminada: {null_count}")
    
    # Guardar archivo final
    print(f"\nGuardando archivo final...")
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    
    print(f"📁 Archivo guardado: {OUTPUT_JSON}")
    print(f"✅ Proceso completado!")

if __name__ == "__main__":
    update_images_with_default()