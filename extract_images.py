import json
import time
import random
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import pandas as pd
import os
import signal
import sys

# CONFIGURACIÓN
INPUT_JSON = 'dataset/restaurants_list.json'
INPUT_CSV = 'dataset/restaurants_info.csv'
OUTPUT_JSON = 'restaurants_with_real_images.json'
CHECKPOINT_FILE = 'extract_progress.json'

# Configurar Chrome
chrome_options = Options()
chrome_options.add_argument('--headless')
chrome_options.add_argument('--no-sandbox')
chrome_options.add_argument('--disable-dev-shm-usage')
chrome_options.add_argument('--disable-gpu')
chrome_options.add_argument('--window-size=1920,1080')
chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
chrome_options.add_argument('--disable-blink-features=AutomationControlled')
chrome_options.add_experimental_option('excludeSwitches', ['enable-automation'])
chrome_options.add_experimental_option('useAutomationExtension', False)

def init_driver():
    """Inicializar el driver de Chrome"""
    try:
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        driver.set_page_load_timeout(30)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return driver
    except Exception as e:
        print(f"Error inicializando Chrome: {e}")
        return None

def extract_image(driver, url):
    """Extraer la imagen usando Selenium"""
    try:
        driver.get(url)
        time.sleep(2 + random.random() * 2)  # Espera aleatoria 2-4 segundos
        
        # MÉTODO 1: Buscar img con data-test
        try:
            img = driver.find_element(By.CSS_SELECTOR, 'img[data-test="restaurant-profile-photo"]')
            src = img.get_attribute('src')
            if src:
                return src
        except:
            pass
        
        # MÉTODO 2: Buscar en srcset
        try:
            imgs = driver.find_elements(By.TAG_NAME, 'img')
            for img in imgs:
                srcset = img.get_attribute('srcset')
                if srcset and 'resizer.otstatic.com' in srcset:
                    urls = srcset.split(',')
                    last_url = urls[-1].strip().split(' ')[0]
                    return last_url
        except:
            pass
        
        # MÉTODO 3: Buscar cualquier img con otstatic
        try:
            imgs = driver.find_elements(By.TAG_NAME, 'img')
            for img in imgs:
                src = img.get_attribute('src')
                if src and ('resizer.otstatic.com' in src or 'otstatic.com' in src):
                    return src
        except:
            pass
        
        # MÉTODO 4: Buscar og:image
        try:
            og_image = driver.find_element(By.CSS_SELECTOR, 'meta[property="og:image"]')
            content = og_image.get_attribute('content')
            if content:
                return content
        except:
            pass
        
        return None
        
    except Exception as e:
        print(f"  Error: {str(e)[:80]}")
        return None

def load_checkpoint():
    """Cargar el progreso guardado"""
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_checkpoint(data):
    """Guardar el progreso"""
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump(data, f)

def load_data():
    """Cargar y procesar los datos"""
    print("Cargando datos...")
    
    with open(INPUT_JSON, 'r', encoding='utf-8') as f:
        restaurants = json.load(f)
    
    df_info = pd.read_csv(INPUT_CSV, delimiter=';')
    info_dict = df_info.set_index('objectID').to_dict('index')
    
    records = []
    for restaurant in restaurants:
        restaurant['objectID'] = int(restaurant['objectID'])
        additional_info = info_dict.get(restaurant['objectID'], {})
        
        restaurant['cuisine_type'] = additional_info.get('food_type', 'N/A')
        price_mapping = {1: '$', 2: '$$', 3: '$$$', 4: '$$$$'}
        restaurant['price_range_string'] = price_mapping.get(restaurant.get('price', 0), 'N/A')
        restaurant['stars_count'] = float(additional_info.get('stars_count', 0))
        restaurant['reviews_count'] = int(additional_info.get('reviews_count', 0))
        restaurant['phone'] = additional_info.get('phone_number', '')
        restaurant['dining_style'] = additional_info.get('dining_style', '')
        
        records.append(restaurant)
    
    return records

def main():
    """Función principal"""
    print("=== EXTRACTOR DE IMÁGENES DE OPENTABLE ===")
    print("=" * 50)
    
    # Cargar datos
    records = load_data()
    print(f"Total de restaurantes: {len(records)}")
    
    # Cargar checkpoint
    checkpoint = load_checkpoint()
    start_index = checkpoint.get('last_index', 0)
    results = checkpoint.get('results', {})
    
    print(f"Reanudando desde índice: {start_index}")
    
    # Inicializar driver
    driver = init_driver()
    if not driver:
        print("No se pudo inicializar Chrome. Saliendo...")
        return
    
    success_count = len([v for v in results.values() if v])
    fail_count = len(results) - success_count
    
    try:
        for i in range(start_index, len(records)):
            record = records[i]
            restaurant_id = record['objectID']
            
            # Construir URL
            profile_url = f"https://www.opentable.com/restaurant/profile/{restaurant_id}/reserve?rid={restaurant_id}"
            
            print(f"\n[{i+1}/{len(records)}] Procesando: {record['name']} ({restaurant_id})")
            
            # Extraer imagen
            real_image = extract_image(driver, profile_url)
            
            if real_image:
                record['image_url'] = real_image
                results[str(restaurant_id)] = real_image
                success_count += 1
                print(f"  ✅ Imagen encontrada: {real_image[:60]}...")
            else:
                results[str(restaurant_id)] = None
                fail_count += 1
                print(f"  ❌ Usando imagen original")
            
            # Guardar checkpoint cada 5 restaurantes
            if (i + 1) % 5 == 0:
                checkpoint['last_index'] = i + 1
                checkpoint['results'] = results
                save_checkpoint(checkpoint)
                
                # Guardar JSON parcial
                with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
                    json.dump(records, f, ensure_ascii=False, indent=2)
                
                print(f"\n  📊 Progreso: {i+1}/{len(records)}")
                print(f"  ✅ Éxito: {success_count} | ❌ Fallidos: {fail_count}")
                print(f"  💾 Checkpoint guardado")
            
            # Pausa aleatoria para evitar bloqueos
            time.sleep(1 + random.random())
        
        print(f"\n=== RESULTADOS FINALES ===")
        print(f"✅ Éxito: {success_count}")
        print(f"❌ Fallidos: {fail_count}")
        print(f"Total procesados: {len(records)}")
        
        # Guardar archivo final
        with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        
        print(f"\n📁 Archivo guardado: {OUTPUT_JSON}")
        
    except KeyboardInterrupt:
        print("\n\n⏹️ Proceso interrumpido por el usuario")
        print("Guardando progreso...")
        
        # Guardar progreso
        checkpoint['last_index'] = i
        checkpoint['results'] = results
        save_checkpoint(checkpoint)
        
        with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        
        print("✅ Progreso guardado. Puedes reanudar ejecutando el script nuevamente.")
        
    finally:
        # Cerrar driver
        if driver:
            driver.quit()
            print("\n👋 Navegador cerrado")

if __name__ == "__main__":
    main()