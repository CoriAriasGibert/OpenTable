import json
from algoliasearch.search.client import SearchClientSync

# Configuración
ALGOLIA_APP_ID = 'HBSG4O6ZTO'
ALGOLIA_API_KEY = 'df39a95b744c6c278d41de3d8ec87ba7'  # Reemplaza esto
ALGOLIA_INDEX_NAME = 'restaurants'

# Cargar el JSON procesado
with open('restaurants_processed.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

# Inicializar cliente
client = SearchClientSync(ALGOLIA_APP_ID, ALGOLIA_API_KEY)

# Subir en lotes
batch_size = 1000
for i in range(0, len(records), batch_size):
    batch = records[i:i + batch_size]
    client.save_objects(
        index_name=ALGOLIA_INDEX_NAME,
        objects=batch,
    )
    print(f"Lote {i//batch_size + 1} enviado ({len(batch)} registros)")

print("¡Datos subidos correctamente!")