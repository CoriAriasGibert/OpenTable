import json
import os

# Configuration
INPUT_JSON = 'restaurants_with_real_images.json'  # File with the restaurant data
CHECKPOINT_FILE = 'extract_progress.json'  # the checkpoint file to save progress
OUTPUT_JSON = 'restaurants_with_real_images_final.json'  # Final file

# Default image URL to use when no image is found
DEFAULT_IMAGE = 'https://media.istockphoto.com/id/116659195/fr/photo/derri%C3%A8re-une-table.jpg?s=612x612&w=0&k=20&c=TtufQGmVTjERoRbvq_6BxSpMsVSvQWHBRmX0JB5S9Xw='

def update_images_with_default():
    """Actualizar los registros que tienen null con la imagen predeterminada"""
    print("=== ACTUALIZANDO IMÁGENES FALTANTES ===")
    print("=" * 50)
    
    # upload the restaurant data
    print("Cargando restaurantes...")
    with open(INPUT_JSON, 'r', encoding='utf-8') as f:
        records = json.load(f)
    
    print(f"Total de registros: {len(records)}")
    
    # upload the checkpoint with the results
    print("Cargando checkpoint...")
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, 'r') as f:
            checkpoint = json.load(f)
        results = checkpoint.get('results', {})
        print(f"Resultados en checkpoint: {len(results)}")
    else:
        results = {}
        print("No se encontró checkpoint, usando datos del JSON")
    
    # containers for statistics
    updated_count = 0
    already_have_image = 0
    null_count = 0
    
    # update records with default image if they have null or no image
    for record in records:
        restaurant_id = str(record['objectID'])
        current_image = record.get('image_url', None)
        
        # if the current image is None, null, or 'None', we will check the checkpoint and update accordingly
        if not current_image or current_image == 'None' or current_image == 'null':
            # Check if we have a result in the checkpoint
            if restaurant_id in results and results[restaurant_id]:
                # Use the image from the checkpoint
                record['image_url'] = results[restaurant_id]
                updated_count += 1
                print(f"  ✅ {record['name']}: Usando imagen del checkpoint")
            else:
                # No image found, use the default image
                record['image_url'] = DEFAULT_IMAGE
                updated_count += 1
                null_count += 1
                print(f"  ⚠️ {record['name']}: Usando imagen predeterminada")
        else:
            already_have_image += 1
            # If it already has an image, verify it's not the default OpenTable image
            # (default images have the format https://www.opentable.com/img/restimages/)
            if 'opentable.com/img/restimages' in current_image:
                # This is a generic image, replace it with the default
                record['image_url'] = DEFAULT_IMAGE
                updated_count += 1
                print(f"  ⚠️ {record['name']}: Imagen genérica reemplazada")
    
    print(f"\n=== RESUMEN ===")
    print(f"✅ Ya tenían imagen: {already_have_image}")
    print(f"🔄 Actualizados: {updated_count}")
    print(f"⚠️ Con imagen predeterminada: {null_count}")
    
    # Save the final JSON
    print(f"\nGuardando archivo final...")
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    
    print(f"📁 Archivo guardado: {OUTPUT_JSON}")
    print(f"✅ Proceso completado!")

if __name__ == "__main__":
    update_images_with_default()