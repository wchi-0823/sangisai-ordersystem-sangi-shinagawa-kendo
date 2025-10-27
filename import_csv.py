import csv
import firebase_admin
from firebase_admin import credentials, firestore

def main():
    """メインの処理を実行する関数"""
    
    # --- 1. Firebaseの初期化 ---
    # 'firebase-key.json'を使ってFirebaseサービスに接続する
    try:
        cred = credentials.Certificate('firebase-key.json')
        # アプリが既に初期化されていなければ初期化する
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
    except FileNotFoundError:
        print("エラー: 'firebase-key.json'が見つかりません。")
        print("Firebaseコンソールから秘密鍵をダウンロードし、このスクリプトと同じディレクトリに配置してください。")
        return # 処理を中断

    # Firestoreデータベースへの接続クライアントを取得
    db = firestore.client()

    # --- 2. CSVファイルの読み込みと処理 ---
    try:
        # 'items.csv'をUTF-8エンコーディングで開く
        # 'utf-8-sig'は、Excelなどが自動で付与するBOM(Byte Order Mark)を無視するための指定
        with open('items.csv', 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            
            # ヘッダー行を読み飛ばす
            header = next(reader) 
            
            print("Firestoreへの商品データ登録を開始します...")
            
            # CSVの各行をループして処理
            for i, row in enumerate(reader, 1):
                try:
                    # --- データの抽出と整形 ---
                    item_id = row[0]
                    name = row[1]
                    price_str = row[2]
                    category = row[3]
                    image_url = row[4]
                    description = row[5]
                    status_str = row[6]
                    
                    # 金額から'¥'マークなどを取り除き、数値(整数)に変換
                    # price = int(price_str.replace('¥', '').replace(',', '')) # カンマにも対応
                    price = int(price_str) # CSVテンプレートから¥を削除したので、シンプルな変換でOK

                    # '販売中'/'売り切れ'の文字列を、True/Falseのブール値に変換
                    is_sold_out = (status_str == '売り切れ')
                    
                    # --- Firestoreに保存するデータを作成 ---
                    item_data = {
                        'name': name,
                        'price': price,
                        'category': category,
                        'imageUrl': image_url,
                        'description': description,
                        'isSoldOut': is_sold_out
                    }
                    
                    # --- Firestoreへの書き込み ---
                    # CSVの'ItemID'をドキュメントIDとして、データをセット(上書き)する
                    db.collection('items').document(item_id).set(item_data)
                    
                    # 進行状況をコンソールに表示
                    print(f"  > 登録完了: {item_id} {name}")
                
                except IndexError:
                    print(f"  > エラー: {i}行目のデータ形式が正しくありません。列が不足している可能性があります。")
                except ValueError:
                    print(f"  > エラー: {i}行目の価格 '{price_str}' を数値に変換できません。")
            
            print("\n全てのデータの登録が完了しました。")

    except FileNotFoundError:
        print("\nエラー: 'items.csv'が見つかりません。")
        print("このスクリプトと同じディレクトリに、商品データCSVを配置してください。")
    except Exception as e:
        print(f"\n予期せぬエラーが発生しました: {e}")


# --- スクリプトのエントリーポイント ---
if __name__ == '__main__':
    main()