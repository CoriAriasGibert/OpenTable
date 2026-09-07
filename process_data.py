import json
import pandas as pd

print("Loading data...")

# Load the JSON file
with open('dataset/restaurants_list.json', 'r', encoding='utf-8') as f:
    restaurants = json.load(f)

# Load the CSV file
df_info = pd.read_csv('dataset/restaurants_info.csv', delimiter=';')

print("Procesando y combinando datos...")

# Normalize the 'objectID' in the JSON 
for restaurant in restaurants:
    restaurant['objectID'] = int(restaurant['objectID'])

# Convert the 'objectID' column in the DataFrame to int
df_info['objectID'] = df_info['objectID'].astype(int)

# Create a dictionary from the CSV for quick lookup based on objectID
info_dict = df_info.set_index('objectID').to_dict('index')

# Prepare a list to hold the indexed records
indexed_records = []

for restaurant in restaurants:
    obj_id = restaurant['objectID']
    
    # Obtein additional info from the CSV based on objectID
    additional_info = info_dict.get(obj_id, {})
    
    # --- Modify fields ---
    
    # 1. Add 'cuisine_type' from the CSV if available, otherwise default to 'N/A'
    restaurant['cuisine_type'] = additional_info.get('food_type', 'N/A')
    
    # 2. Convert 'price' to a more user-friendly value
    price_mapping = {
        1: "$",
        2: "$$",
        3: "$$$",
        4: "$$$$"
    }
    restaurant['price_range_string'] = price_mapping.get(restaurant.get('price', 0), 'N/A')
    
    # 3. Modify the numeric fields from the CSV
    restaurant['stars_count'] = float(additional_info.get('stars_count', 0))
    restaurant['reviews_count'] = int(additional_info.get('reviews_count', 0))
    
    # Add the phone number if available
    restaurant['phone'] = additional_info.get('phone_number', '')
    
    # Add the dining style if available
    restaurant['dining_style'] = additional_info.get('dining_style', '')
    
    indexed_records.append(restaurant)

print(f"Total de registros procesados: {len(indexed_records)}")

# Save the processed JSON file
output_file = 'restaurants_processed.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(indexed_records, f, ensure_ascii=False, indent=2)

print(f"Archivo '{output_file}' generado correctamente!")
print(f"Puedes subirlo manualmente al dashboard de Algolia.")