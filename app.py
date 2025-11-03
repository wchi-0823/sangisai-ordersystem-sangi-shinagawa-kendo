"""
文化祭模擬店 注文管理システム - バックエンドAPIサーバー (最終版)
認証方式: Flask-Login (セッションベース認証) - 最終修正版
"""

# --- ライブラリのインポート ---
import firebase_admin
from firebase_admin import credentials, firestore, auth
from flask import Flask, render_template, request, jsonify, Response, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
import random
import datetime
import pandas as pd
import io
import os
from functools import wraps # 権限チェックデコレータのために追加

# --- アプリケーションの初期設定 ---

# 1. Firebaseの初期化
try:
    cred = credentials.Certificate('firebase-key.json')
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
except FileNotFoundError:
    print("FATAL ERROR: 'firebase-key.json' not found.")
    print("Please download the service account key from Firebase console.")
    exit()

db = firestore.client()

# 2. Flaskアプリケーションの初期化
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24))

# --- 認証機能 (Flask-Login) の設定 ---
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = "このページにアクセスするにはログインが必要です。"
login_manager.login_message_category = "error"

# ユーザー情報を保持するためのクラス
class User(UserMixin):
    def __init__(self, user_data):
        self.id = user_data.get('username')
        self.data = user_data
    
    def get_role(self):
        return self.data.get('role')

@login_manager.user_loader
def load_user(user_id):
    user_doc = db.collection('users').document(user_id).get()
    if user_doc.exists:
        return User(user_doc.to_dict())
    return None

@login_manager.unauthorized_handler
def unauthorized():
    return redirect(url_for('login', next=request.path))

@app.context_processor
def inject_store_settings():
    try:
        doc = db.collection('store_settings').document('main').get()
        if doc.exists:
            return doc.to_dict()
    except Exception as e:
        print(f"Error injecting store settings: {e}")
    return {}

def role_required(page_name):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if current_user.get_role() == 'superadmin':
                return f(*args, **kwargs)
            try:
                permissions_doc = db.collection('permissions').document('role_access').get()
                if permissions_doc.exists:
                    permissions = permissions_doc.to_dict()
                    user_role = current_user.get_role()
                    if permissions.get(user_role, {}).get(page_name, False):
                        return f(*args, **kwargs)
            except Exception as e:
                print(f"Error checking permissions: {e}")
            return redirect(url_for('unauthorized_page'))
        return decorated_function
    return decorator

# ====================================================================
# ログイン・ログアウト・権限エラー用ルート
# ====================================================================
@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        next_page = request.args.get('next')
        return redirect(next_page or url_for('admin'))
    
    next_page_url = request.args.get('next') or request.form.get('next') or ''
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user_doc = db.collection('users').document(username).get()
        if user_doc.exists and check_password_hash(user_doc.to_dict().get('passwordHash', ''), password):
            user = User(user_doc.to_dict())
            login_user(user)
            return redirect(next_page_url or url_for('admin'))
    return render_template('login.html', next=next_page_url)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('ログアウトしました。')
    return redirect(url_for('login'))

@app.route('/unauthorized')
def unauthorized_page():
    return render_template('unauthorized.html'), 403

# ====================================================================
# ページ表示用ルート
# ====================================================================
@app.route('/')
def index():
    doc = db.collection('store_settings').document('main').get()
    is_open = doc.to_dict().get('isStoreOpen', True) if doc.exists else True
    if not is_open:
        return render_template('closed.html')
    
    items_ref = db.collection('items').stream()
    items_list = []
    items_map = {} # JavaScriptに渡すための商品情報マップ
    for item in items_ref:
        item_data = item.to_dict()
        item_data['ItemID'] = item.id
        items_list.append(item_data)
        items_map[item.id] = {
            'name': item_data.get('name'),
            'price': item_data.get('price')
        }

    all_categories = sorted(list(set(item.get('category', '未分類') for item in items_list)))
    
    return render_template('index.html', 
                           items=items_list, 
                           categories=all_categories,
                           items_map=items_map)

@app.route('/cart')
def cart():
    return render_template('cart.html')

@app.route('/order_complete')
def order_complete():
    order_id = request.args.get('order_id', None)
    order_data = None
    if order_id:
        try:
            doc = db.collection('orders').document(order_id).get()
            if doc.exists:
                order_data = doc.to_dict()
                timestamp = order_data.get('createdAt')
                if timestamp:
                    jst_time = timestamp + datetime.timedelta(hours=9)
                    order_data['formatted_time'] = jst_time.strftime('%Y-%m-%d %H:%M:%S')
        except Exception as e:
            print(f"Error getting order data: {e}")
    return render_template('order_complete.html', order=order_data)

@app.route('/kitchen')
@login_required
@role_required('kitchen')
def kitchen():
    return render_template('kitchen.html')

@app.route('/display')
@login_required
@role_required('display')
def display():
    return render_template('display.html')

@app.route('/cashier')
@login_required
@role_required('cashier')
def cashier():
    return render_template('cashier.html')

@app.route('/payment')
@login_required
def payment():
    ticket_number = request.args.get('ticket', None)
    return render_template('payment.html', ticket_number=ticket_number)

@app.route('/admin')
@login_required
@role_required('admin')
def admin():
    return render_template('admin.html', current_user=current_user.data)

@app.route('/signage')
def signage():
    return render_template('signage.html')

# ====================================================================
# APIエンドポイント
# ====================================================================
@app.route('/order', methods=['POST'])
def create_order():
    try:
        cart_items = request.get_json()
        total_price = sum(item['price'] * item['quantity'] for item in cart_items if 'price' in item and 'quantity' in item)
        new_ticket_number = f"{random.randint(0, 9999):04d}"
        order_data = {
            'ticketNumber': new_ticket_number, 'items': cart_items, 'totalPrice': total_price,
            'status': '調理中', 'paymentStatus': '未会計', 'createdAt': firestore.SERVER_TIMESTAMP
        }
        update_time, doc_ref = db.collection('orders').add(order_data)
        return jsonify({'success': True, 'ticketNumber': new_ticket_number, 'orderId': doc_ref.id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/get_order_by_ticket', methods=['GET'])
def get_order_by_ticket():
    ticket_number = request.args.get('ticket', None)
    if not ticket_number: return jsonify({'success': False, 'error': 'Ticket number is required'}), 400
    try:
        docs = db.collection('orders').where('ticketNumber', '==', ticket_number).limit(1).stream()
        for doc in docs:
            return jsonify({'success': True, 'order': doc.to_dict(), 'docId': doc.id})
        return jsonify({'success': False, 'error': 'Order not found'}), 404
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/update_payment_status', methods=['POST'])
@login_required
def update_payment_status():
    data = request.get_json()
    doc_id = data.get('docId')
    if not doc_id: return jsonify({'success': False, 'error': 'Document ID is required'}), 400
    try:
        db.collection('orders').document(doc_id).update({'paymentStatus': '会計済'})
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/update_order_status', methods=['POST'])
@login_required
def update_order_status():
    if not current_user.is_authenticated:
        return jsonify({'success': False, 'error': 'Forbidden'}), 403
    try:
        data = request.get_json()
        doc_id = data.get('docId')
        new_status = data.get('status')
        if not all([doc_id, new_status]):
            return jsonify({'success': False, 'error': 'Missing data'}), 400
        db.collection('orders').document(doc_id).update({'status': new_status})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/get_items', methods=['GET'])
@login_required
def get_items():
    if current_user.get_role() not in ['admin', 'superadmin']: return jsonify({'error': 'Forbidden'}), 403
    try:
        items_list = [dict(item.to_dict(), **{'id': item.id}) for item in db.collection('items').stream()]
        return jsonify(items_list)
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/update_item', methods=['POST'])
@login_required
def update_item():
    if current_user.get_role() not in ['admin', 'superadmin']: return jsonify({'success': False, 'error': 'Forbidden'}), 403
    try:
        data = request.get_json()
        doc_id, field, value = data.get('id'), data.get('field'), data.get('value')
        if not all([doc_id, field, value is not None]): return jsonify({'success': False, 'error': 'Missing data'}), 400
        if field == 'price' or field == 'setCount': value = int(value)
        elif field == 'isSoldOut' or field == 'isSet': value = bool(value)
        db.collection('items').document(doc_id).update({field: value})
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/upload_csv', methods=['POST'])
@login_required
def upload_csv():
    if current_user.get_role() not in ['admin', 'superadmin']: return jsonify({'success': False, 'error': 'Forbidden'}), 403
    if 'csv-file' not in request.files: return jsonify({'success': False, 'error': 'No file part'}), 400
    file = request.files['csv-file']
    if file.filename == '' or not file.filename.endswith('.csv'): return jsonify({'success': False, 'error': 'Invalid file'}), 400
    try:
        csv_data = io.StringIO(file.stream.read().decode("utf-8-sig"))
        df = pd.read_csv(csv_data)
        
        required_columns = ['ItemID', 'Name', 'Price', 'Category', 'Status', 'Allergens', 'IsSet', 'SetCount', 'SetItems']
        if not all(col in df.columns for col in required_columns):
            return jsonify({'success': False, 'error': 'CSVの列名が不正です。IsSet, SetCount, SetItems列などを確認してください。'}), 400

        for doc in db.collection('items').stream(): doc.reference.delete()

        for index, row in df.iterrows():
            allergens_str = str(row['Allergens']) if pd.notna(row['Allergens']) else ''
            allergens_list = [allergen.strip() for allergen in allergens_str.split(',') if allergen.strip()]
            
            is_set = bool(row['IsSet'])
            set_count = int(row['SetCount']) if is_set else 0
            set_items_str = str(row['SetItems']) if is_set and pd.notna(row['SetItems']) else ''
            set_items_list = [item.strip() for item in set_items_str.split(',') if item.strip()]

            item_data = {
                'name': row['Name'], 'price': int(row['Price']), 'category': row['Category'],
                'imageUrl': str(row['ImageURL']) if pd.notna(row['ImageURL']) else '',
                'description': str(row['Description']) if pd.notna(row['Description']) else '',
                'isSoldOut': bool(row['Status'] == '売り切れ'),
                'allergens': allergens_list,
                'isSet': is_set,
                'setCount': set_count,
                'setItems': set_items_list
            }
            db.collection('items').document(row['ItemID']).set(item_data)
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/download_template_csv')
@login_required
def download_template_csv():
    if current_user.get_role() not in ['admin', 'superadmin']: return "Access Denied", 403
    csv_header = "ItemID,Name,Price,Category,ImageURL,Description,Status,Allergens,IsSet,SetCount,SetItems\n"
    return Response(csv_header, mimetype="text/csv", headers={"Content-disposition": "attachment; filename=menu_template.csv"})

@app.route('/api/get_sales_data')
@login_required
def get_sales_data():
    if current_user.get_role() not in ['admin', 'superadmin']: return jsonify({'error': 'Forbidden'}), 403
    try:
        all_items_ordered, total_revenue, total_orders = [], 0, 0
        items_master = {doc.id: doc.to_dict() for doc in db.collection('items').stream()}
        items_by_name = {data['name']: data for id, data in items_master.items()}
        for order_doc in db.collection('orders').stream():
            order_data = order_doc.to_dict()
            total_revenue += order_data.get('totalPrice', 0)
            total_orders += 1
            for item in order_data.get('items', []):
                if item.get('isSet'):
                    category = items_master.get(item['id'], {}).get('category', 'セット')
                    all_items_ordered.append({'name': item['name'], 'quantity': 1, 'subtotal': item['price'], 'category': category})
                else:
                    category = items_by_name.get(item['name'], {}).get('category', '未分類')
                    all_items_ordered.append({'name': item['name'], 'quantity': item['quantity'], 'subtotal': item['price'] * item['quantity'], 'category': category})
        
        if not all_items_ordered: return jsonify({'total_revenue': 0, 'total_orders': 0, 'sales_by_item': {}, 'sales_by_category': {}})
        df = pd.DataFrame(all_items_ordered)
        sales_by_item = df.groupby('name')['quantity'].sum().sort_values(ascending=False)
        sales_by_category = df.groupby('category')['subtotal'].sum().sort_values(ascending=False)
        dashboard_data = {'total_revenue': total_revenue, 'total_orders': total_orders, 'sales_by_item': sales_by_item.to_dict(), 'sales_by_category': sales_by_category.to_dict()}
        return jsonify(dashboard_data)
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/download_sales_csv')
@login_required
def download_sales_csv():
    if current_user.get_role() not in ['admin', 'superadmin']: return "Access Denied", 403
    try:
        all_items_ordered = []
        items_master = {doc.id: doc.to_dict() for doc in db.collection('items').stream()}
        items_by_name = {data['name']: data for id, data in items_master.items()}
        for order_doc in db.collection('orders').stream():
            order_data = order_doc.to_dict()
            for item in order_data.get('items', []):
                if item.get('isSet'):
                    all_items_ordered.append({'name': item['name'], 'quantity': 1, 'subtotal': item['price'], 'category': 'セット'})
                else:
                    category = items_by_name.get(item['name'], {}).get('category', '未分類')
                    all_items_ordered.append({'name': item['name'], 'quantity': item['quantity'], 'subtotal': item['price'] * item['quantity'], 'category': category})
        
        if not all_items_ordered: return "No data", 404
        df = pd.DataFrame(all_items_ordered)
        csv_output = io.StringIO()
        df.to_csv(csv_output, index=False, encoding='utf-8-sig')
        return Response(csv_output.getvalue(), mimetype="text/csv", headers={"Content-disposition": "attachment; filename=sales_details.csv"})
    except Exception as e: return str(e), 500

@app.route('/api/get_store_status', methods=['GET'])
def get_store_status():
    try:
        doc = db.collection('store_settings').document('main').get()
        if doc.exists:
            return jsonify({'isStoreOpen': doc.to_dict().get('isStoreOpen', True)})
        return jsonify({'isStoreOpen': True})
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/update_store_status', methods=['POST'])
@login_required
def update_store_status():
    if current_user.get_role() not in ['admin', 'superadmin']: return jsonify({'success': False, 'error': 'Forbidden'}), 403
    try:
        data = request.get_json()
        new_status = data.get('isStoreOpen')
        if new_status is None: return jsonify({'success': False, 'error': 'Missing data'}), 400
        db.collection('store_settings').document('main').set({'isStoreOpen': bool(new_status)}, merge=True)
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/get_signage_items')
def get_signage_items():
    try:
        items_list, settings_data = [], {'fadeDuration': 1.5}
        for doc in db.collection('signage_items').stream():
            if doc.id == '--config--':
                settings_data = doc.to_dict()
            else:
                item_data = doc.to_dict()
                item_data['id'] = doc.id
                items_list.append(item_data)
        items_list.sort(key=lambda x: x.get('order', 0))
        return jsonify({'items': items_list, 'settings': settings_data})
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/get_signage_list', methods=['GET'])
@login_required
def get_signage_list():
    if current_user.get_role() not in ['admin', 'superadmin']: return jsonify({'error': 'Forbidden'}), 403
    try:
        docs = db.collection('signage_items').order_by('order').stream()
        items_list = [dict(doc.to_dict(), **{'id': doc.id}) for doc in docs if doc.id != '--config--']
        return jsonify(items_list)
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/update_signage_item', methods=['POST'])
@login_required
def update_signage_item():
    if current_user.get_role() not in ['admin', 'superadmin']: return jsonify({'success': False, 'error': 'Forbidden'}), 403
    try:
        data = request.get_json()
        doc_id, field, value = data.get('id'), data.get('field'), data.get('value')
        if not all([doc_id, field, value is not None]): return jsonify({'success': False, 'error': 'Missing data'}), 400
        if field in ['duration', 'order']: value = int(value)
        db.collection('signage_items').document(doc_id).update({field: value})
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/upload_signage_csv', methods=['POST'])
@login_required
def upload_signage_csv():
    if current_user.get_role() not in ['admin', 'superadmin']: return jsonify({'success': False, 'error': 'Forbidden'}), 403
    if 'csv-file' not in request.files: return jsonify({'success': False, 'error': 'No file part'}), 400
    file = request.files['csv-file']
    if file.filename == '' or not file.filename.endswith('.csv'): return jsonify({'success': False, 'error': 'Invalid file'}), 400
    try:
        for doc in db.collection('signage_items').stream():
            if doc.id != '--config--':
                doc.reference.delete()
        csv_data = io.StringIO(file.stream.read().decode("utf-8-sig"))
        df = pd.read_csv(csv_data)
        for index, row in df.iterrows():
            item_data = {'url': row['url'], 'duration': int(row['duration']), 'order': int(row['order'])}
            db.collection('signage_items').add(item_data)
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/download_signage_template_csv')
@login_required
def download_signage_template_csv():
    if current_user.get_role() not in ['admin', 'superadmin']: return "Access Denied", 403
    csv_header = "url,duration,order\n"
    return Response(csv_header, mimetype="text/csv", headers={"Content-disposition": "attachment; filename=signage_template.csv"})

@app.route('/api/get_users', methods=['GET'])
@login_required
def get_users():
    if current_user.get_role() != 'superadmin': return jsonify({'error': 'Forbidden'}), 403
    try:
        users_list = [dict(doc.to_dict(), **{'id': doc.id, 'passwordHash': None}) for doc in db.collection('users').stream()]
        return jsonify(users_list)
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/add_user', methods=['POST'])
@login_required
def add_user():
    if current_user.get_role() != 'superadmin': return jsonify({'success': False, 'error': 'Forbidden'}), 403
    try:
        data = request.get_json()
        username, password, role = data.get('username'), data.get('password'), data.get('role')
        if not all([username, password, role]): return jsonify({'success': False, 'error': 'Missing data'}), 400
        if role not in ['admin', 'superadmin', 'staff']: return jsonify({'success': False, 'error': 'Invalid role'}), 400
        if db.collection('users').document(username).get().exists: return jsonify({'success': False, 'error': 'Username already exists'}), 400
        user_data = {'username': username, 'passwordHash': generate_password_hash(password), 'role': role}
        db.collection('users').document(username).set(user_data)
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/delete_user', methods=['POST'])
@login_required
def delete_user():
    if current_user.get_role() != 'superadmin': return jsonify({'success': False, 'error': 'Forbidden'}), 403
    try:
        data = request.get_json()
        username = data.get('username')
        if not username: return jsonify({'success': False, 'error': 'Username is required'}), 400
        if username == current_user.id: return jsonify({'success': False, 'error': 'Cannot delete yourself'}), 400
        db.collection('users').document(username).delete()
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

def delete_collection(coll_ref):
    for doc in coll_ref.stream():
        doc.reference.delete()

@app.route('/api/reset_data', methods=['POST'])
@login_required
def reset_data():
    if current_user.get_role() != 'superadmin': return jsonify({'success': False, 'error': 'Forbidden'}), 403
    try:
        for coll_name in ['orders', 'items', 'signage_items']:
            delete_collection(db.collection(coll_name))
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/reset_all', methods=['POST'])
@login_required
def reset_all():
    if current_user.get_role() != 'superadmin': return jsonify({'success': False, 'error': 'Forbidden'}), 403
    try:
        for coll_name in ['orders', 'items', 'signage_items']:
            delete_collection(db.collection(coll_name))
        for doc in db.collection('users').stream():
            if doc.id != current_user.id:
                doc.reference.delete()
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/reset_super', methods=['POST'])
@login_required
def reset_super():
    if current_user.get_role() != 'superadmin': return jsonify({'success': False, 'error': 'Forbidden'}), 403
    try:
        for coll_name in ['orders', 'items', 'signage_items', 'users']:
            delete_collection(db.collection(coll_name))
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/get_store_settings', methods=['GET'])
@login_required
def get_store_settings():
    if current_user.get_role() not in ['admin', 'superadmin']: return jsonify({'error': 'Forbidden'}), 403
    doc = db.collection('store_settings').document('main').get()
    return jsonify(doc.to_dict()) if doc.exists else jsonify({})

@app.route('/api/update_store_settings', methods=['POST'])
@login_required
def update_store_settings():
    if current_user.get_role() not in ['admin', 'superadmin']: return jsonify({'success': False, 'error': 'Forbidden'}), 403
    try:
        data = request.get_json()
        db.collection('store_settings').document('main').set(data, merge=True)
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/get_permissions', methods=['GET'])
@login_required
def get_permissions():
    if current_user.get_role() != 'superadmin': return jsonify({'error': 'Forbidden'}), 403
    try:
        doc = db.collection('permissions').document('role_access').get()
        if doc.exists:
            return jsonify(doc.to_dict())
        else:
            return jsonify({
                'admin': {'kitchen': True, 'display': True, 'cashier': True, 'admin': True},
                'staff': {'kitchen': False, 'display': True, 'cashier': True, 'admin': False}
            })
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/api/update_permissions', methods=['POST'])
@login_required
def update_permissions():
    if current_user.get_role() != 'superadmin': return jsonify({'success': False, 'error': 'Forbidden'}), 403
    try:
        new_permissions = request.get_json()
        db.collection('permissions').document('role_access').set(new_permissions)
        return jsonify({'success': True})
    except Exception as e: return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)