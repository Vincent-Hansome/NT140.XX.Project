(() => {
  const A = window.MocApi;
  const productImage = (product) => A.image(product.image_url);
  function shopImage(product, lazy = true) {
    const url = productImage(product);
    if (!url) return '<span>Chưa có ảnh</span>';
    return `<img src="${A.escape(url)}" alt="${A.escape(product.name)}"${lazy ? ' loading="lazy"' : ''} decoding="async">`;
  }
  const setMessage = (el, msg, error = false) => { if (!el) return; el.textContent = msg; el.className = `form-message${error ? ' is-error' : ''}`; };
  const refreshBadge = async () => { try { const rows = await A.request('/cart'); document.querySelector('#cart-count').textContent = rows.reduce((n, row) => n + Number(row.quantity), 0); } catch { document.querySelector('#cart-count').textContent = '0'; } };
  refreshBadge();
  A.request('/users/me').then(user => {
    document.querySelector('[data-auth-links]')?.setAttribute('hidden','');
    document.querySelector('[data-profile-nav]')?.removeAttribute('hidden');
    if (user.role === 'admin') document.querySelector('[data-admin-nav]')?.removeAttribute('hidden');
  }).catch(() => {});
  const menuToggle = document.querySelector('#menu-toggle');
  const navigation = document.querySelector('#site-nav');
  if (menuToggle && navigation) {
    const setMenu = open => {
      navigation.classList.toggle('is-open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    };
    menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') === 'false'));
    document.addEventListener('click', event => {
      if (event.target.closest('#site-nav a') || !event.target.closest('.moc-header')) setMenu(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuToggle.focus();
      }
    });
  }

  function productCard(product, index) {
    const href = `/products/${encodeURIComponent(product.id)}${product.matchId != null ? '?variant=' + product.matchId : ''}`;
    const configurable = product.variants?.length > 1;
    const info = configurable ? `${product.variants.length} lựa chọn cỡ và màu` : [product.color, product.size].filter(Boolean).join(' · ');
    const soldOut = Number(product.stock) === 0;
    return `<article class="shop-card">
      <a class="shop-thumb" href="${href}" aria-label="${A.escape(product.name)}">${shopImage(product, index > 3)}</a>
      <p class="shop-card-details">${A.escape(info)}</p>
      <a class="shop-name" href="${href}">${A.escape(product.name)}</a>
      <p class="shop-card-price">${A.money(product.price)}</p>
      ${configurable ? `<a class="shop-add" href="${href}">Chọn cỡ và màu</a>` : `<button type="button" class="shop-add" data-add-product="${A.escape(product.id)}"${soldOut ? ' disabled' : ''}>${soldOut ? 'Hết hàng' : 'Thêm vào giỏ'}</button>`}
      <button type="button" class="save-product" data-save-product="${A.escape(product.id)}" aria-pressed="false">Yêu thích</button>
    </article>`;
  }
  async function loadProducts() {
    const grid = document.querySelector('[data-products]');
    if (!grid) return;
    const count = document.querySelector('[data-product-count]');
    const filters = document.querySelector('[data-category-filters]');
    try {
      const products = await A.request('/products?variants=1');
      const render = (rows) => {
        const limit = Number(grid.dataset.limit) || rows.length;
        if (count) count.textContent = `${rows.length} sản phẩm`;
        grid.innerHTML = rows.slice(0, limit).map(productCard).join('') ||
          '<p class="shop-status">Không tìm thấy sản phẩm phù hợp.</p>';
        grid.dispatchEvent(new CustomEvent('moc:catalog-rendered', { bubbles:true }));
      };
      render(products);
      if (!filters || !products.length) return;
      const search = document.querySelector('[data-catalog-search]');
      const fields = search.elements;
      const fold = value => String(value || '').toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g,'d').trim();
      const allOptions = products.flatMap(product => product.variants);
      for (const field of ['size','color']) {
        const values = [...new Set(allOptions.map(option => option[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));
        values.forEach(value => fields[field].add(new Option(value,value)));
      }
      let categoryId = '';
      function apply() {
        const min = fields.minPrice.valueAsNumber, max = fields.maxPrice.valueAsNumber;
        const rows = [];
        for (const product of products) {
          if (categoryId && String(product.category_id)!==categoryId) continue;
          if (!fold(product.name).includes(fold(fields.query.value)) || product.price < min || product.price > max) continue;
          const match = product.variants.find(option => (!fields.size.value || fields.size.value===option.size) &&
            (!fields.color.value || fields.color.value===option.color) && (!fields.inStock.checked || option.stock>0));
          if (match) rows.push((fields.size.value || fields.color.value || fields.inStock.checked) ? {...product,matchId:match.id} : product);
        }
        render(rows);
      }
      search.addEventListener('input',apply);
      search.addEventListener('submit',event=>{event.preventDefault(); apply();});
      search.addEventListener('reset',()=>{
        categoryId='';
        filters.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.category==='')));
        requestAnimationFrame(apply);
      });
      const categories = await A.request('/categories').catch(() => []);
      const available = categories.filter(category => products.some(product => product.category_id === category.id));
      if (!available.length) return;
      filters.innerHTML = '<button type="button" data-category="" aria-pressed="true">Tất cả</button>' + available.map(category =>
        `<button type="button" data-category="${A.escape(category.id)}" aria-pressed="false">${A.escape(category.name)}</button>`
      ).join('');
      filters.hidden = false;
      filters.addEventListener('click', event => {
        const chosen = event.target.closest('[data-category]');
        if (!chosen) return;
        filters.querySelector('[aria-pressed="true"]').setAttribute('aria-pressed', 'false');
        chosen.setAttribute('aria-pressed', 'true');
        categoryId = chosen.dataset.category;
        apply();
      });
    } catch (err) {
      grid.innerHTML = `<p class="shop-status shop-error" role="alert">${A.escape(err.message)}</p>`;
    }
  }
  loadProducts();
  document.addEventListener('click', async e => {
    const button = e.target.closest('[data-add-product]'); if (!button) return;
    button.disabled = true;
    setMessage(button.parentElement.querySelector('[data-quick-add-message]'), '');
    try { await A.request('/cart', { method: 'POST', body: JSON.stringify({ product_id: button.dataset.addProduct, quantity: 1 }) }); button.textContent = 'Đã thêm'; await refreshBadge(); setTimeout(() => { if (button.isConnected) { button.textContent = 'Thêm vào giỏ'; button.disabled = false; } }, 1300); }
    catch (err) {
      if (err.status === 401) { window.location.assign('/login'); return; }
      let message = button.parentElement.querySelector('[data-quick-add-message]');
      if (!message) {
        message = document.createElement('p');
        message.dataset.quickAddMessage = '';
        message.setAttribute('role', 'alert');
        button.parentElement.appendChild(message);
      }
      setMessage(message, err.status === 403 ? 'Không thể xác thực CSRF. Hãy tải lại trang và thử lại.' : err.message, true);
      button.disabled = false;
    }
  });

  const detail = document.querySelector('[data-product-detail]');
  if (detail) (async () => {
    const id = detail.dataset.productId;
    const message = detail.querySelector('[data-detail-message]');
    try {
      const url = `/products/${encodeURIComponent(id)}`;
      const [product, { variants }] = await Promise.all([A.request(url), A.request(url+'/variants')]);
      detail.querySelector('[data-detail-name]').textContent = product.name;
      detail.querySelector('[data-detail-price]').textContent = A.money(product.price);
      detail.querySelector('[data-detail-description]').textContent = product.description || '';
      const colorSelect = detail.querySelector('[data-detail-color]');
      const sizeSelect = detail.querySelector('[data-detail-size]');
      const requested = new URLSearchParams(location.search).get('variant');
      let chosen = variants.find(v=>String(v.id)===requested) || variants.find(v=>v.stock>0) || variants[0];
      const colors = [...new Set(variants.map(v=>v.color || ''))];
      colors.forEach(color => colorSelect.add(new Option(color || 'Tiêu chuẩn', color)));
      colorSelect.value = chosen.color || '';
      const image = detail.querySelector('[data-detail-image]');
      if (productImage(product)) {
        image.src = productImage(product);
        image.alt = product.name;
        image.hidden = false;
      } else {
        detail.querySelector('[data-detail-no-image]').hidden = false;
      }
      const quantity = detail.querySelector('[data-quantity]');
      const add = detail.querySelector('[data-add-detail]');
      const minus = detail.querySelector('[data-quantity-minus]');
      const plus = detail.querySelector('[data-quantity-plus]');
      let qty = 1;
      const setQuantity = (value) => {
        qty = value;
        quantity.textContent = qty;
        minus.disabled = qty <= 1;
        plus.disabled = qty >= chosen.stock;
      };
      function showSelection() {
        detail.querySelector('[data-detail-stock]').textContent = chosen.stock ? `${chosen.stock} sản phẩm` : 'Hết hàng';
        add.disabled = !chosen.stock;
        add.textContent = chosen.stock ? 'Thêm vào giỏ' : 'Hết hàng';
        setQuantity(chosen.stock ? 1 : 0);
        setMessage(message,'');
      }
      function showSizes() {
        const available = variants.filter(v => (v.color || '') === colorSelect.value);
        chosen = available.find(v=>v.id===chosen.id) || available.find(v=>v.stock>0) || available[0];
        sizeSelect.replaceChildren(...available.map(v=>new Option((v.size || 'Tiêu chuẩn') + (v.stock ? '' : ' · Hết hàng'),String(v.id))));
        sizeSelect.value = String(chosen.id);
        showSelection();
      }
      showSizes();
      colorSelect.onchange = showSizes;
      sizeSelect.onchange = () => { chosen = variants.find(v=>String(v.id)===sizeSelect.value); showSelection(); };
      minus.onclick = () => setQuantity(Math.max(1, qty - 1));
      plus.onclick = () => setQuantity(Math.min(chosen.stock, qty + 1));
      add.onclick = async () => {
        add.disabled = true;
        colorSelect.disabled = sizeSelect.disabled = true;
        try {
          await A.request('/cart', { method: 'POST', body: JSON.stringify({ product_id: product.id, variant_id: chosen.id, quantity: qty }) });
          setMessage(message, `Đã thêm ${qty} sản phẩm vào giỏ hàng.`);
          await refreshBadge();
        } catch (err) {
          if (err.status === 401) location.assign('/login');
          else setMessage(message, err.message, true);
        } finally { add.disabled = !chosen.stock; colorSelect.disabled = sizeSelect.disabled = false; }
      };
    } catch (err) {
      detail.querySelector('[data-detail-name]').textContent = err.status === 404 ? 'Không tìm thấy sản phẩm' : 'Chưa tải được sản phẩm';
      setMessage(message, err.message, true);
    }
  })();

  function basketRow(row, editable) {
    const href = `/products/${encodeURIComponent(row.product_id)}`;
    const name = A.escape(row.name);
    const id = A.escape(row.id);
    const qty = Number(row.quantity);
    const controls = editable ? `<div class="shop-item-actions">
      <div class="shop-stepper" role="group" aria-label="Số lượng ${name}">
        <button type="button" aria-label="Giảm số lượng ${name}" data-cart-qty="${id}" data-value="${qty - 1}">−</button>
        <span>${qty}</span>
        <button type="button" aria-label="Tăng số lượng ${name}" data-cart-qty="${id}" data-value="${qty + 1}">+</button>
      </div>
      <button type="button" class="shop-remove" aria-label="Xóa ${name}" data-cart-remove="${id}">Xóa</button>
    </div>` : `<small>Số lượng: ${qty}</small>`;
    return `<article class="shop-basket-row">
      <a class="shop-basket-thumb" href="${href}" aria-label="${name}">${shopImage(row)}</a>
      <div class="shop-basket-info"><a class="shop-name" href="${href}">${name}</a><small>${A.escape([row.variant_size,row.variant_color].filter(Boolean).join(' · '))}</small><small>${A.money(row.price)} / sản phẩm</small>${controls}</div>
      <strong class="shop-line-price">${A.money(row.price * qty)}</strong>
    </article>`;
  }
  const cartRoot = document.querySelector('[data-cart-page]');
  if (cartRoot) (async () => {
    const list = cartRoot.querySelector('[data-cart-items]');
    const message = cartRoot.querySelector('[data-cart-message]');
    const summary = cartRoot.querySelector('[data-cart-summary]');
    const load = async () => {
      try {
        const rows = await A.request('/cart');
        const count = rows.reduce((sum, row) => sum + Number(row.quantity), 0);
        const total = rows.reduce((sum, row) => sum + Number(row.price) * Number(row.quantity), 0);
        cartRoot.querySelector('[data-cart-item-count]').textContent = `${count} sản phẩm`;
        cartRoot.querySelector('[data-cart-subtotal]').textContent = A.money(total);
        cartRoot.querySelector('[data-cart-total]').textContent = A.money(total);
        summary.hidden = rows.length === 0;
        list.innerHTML = rows.map(row => basketRow(row, true)).join('') ||
          '<div class="shop-empty"><p>Giỏ hàng của bạn đang trống.</p><a class="shop-cta" href="/products">Khám phá bộ sưu tập →</a></div>';
      } catch (err) {
        summary.hidden = true;
        list.innerHTML = err.status === 401
          ? '<div class="shop-empty"><p>Đăng nhập để xem giỏ hàng của bạn.</p><a class="shop-cta" href="/login">Đăng nhập →</a></div>'
          : `<p class="shop-status shop-error" role="alert">${A.escape(err.message)}</p>`;
      }
    };
    await load();
    list.addEventListener('click', async event => {
      const button = event.target.closest('[data-cart-qty], [data-cart-remove]');
      if (!button || list.getAttribute('aria-busy') === 'true') return;
      list.setAttribute('aria-busy', 'true');
      setMessage(message, '');
      const value = Number(button.dataset.value);
      const id = button.dataset.cartQty || button.dataset.cartRemove;
      try {
        const options = value > 0 ? { method: 'PUT', body: JSON.stringify({ quantity: value }) } : { method: 'DELETE' };
        await A.request(`/cart/${encodeURIComponent(id)}`, options);
        await load();
        await refreshBadge();
      } catch (err) { setMessage(message, err.message, true); }
      finally { list.removeAttribute('aria-busy'); }
    });
  })();
  const authForm = document.querySelector('[data-auth-form]');
  if (authForm?.dataset.mode === 'login' && new URLSearchParams(location.search).get('reason') === 'password-changed') {
    setMessage(authForm.querySelector('[data-auth-message]'), 'Mật khẩu đã được cập nhật. Các phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');
  }
  if (authForm) authForm.addEventListener('submit', async e => {
    e.preventDefault(); const message = authForm.querySelector('[data-auth-message]'), button = authForm.querySelector('button[type=submit]'); button.disabled = true; setMessage(message, '');
    const form = new FormData(authForm), payload = Object.fromEntries(form.entries()), mode = authForm.dataset.mode;
    try { const result = await A.request(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(payload) }); if (mode === 'register') { setMessage(message, 'Tài khoản đã tạo. Đang chuyển đến đăng nhập…'); setTimeout(() => location.assign('/login'), 900); } else { location.assign(result.user?.role === 'admin' ? '/admin' : '/profile'); } }
    catch (err) { setMessage(message, err.message, true); button.disabled = false; }
  });


  const profile = document.querySelector('[data-profile-page]');
  if (profile) {
    const message=profile.querySelector('[data-profile-message]');
    const passwordForm = profile.querySelector('[data-password-change-form]');
    const passwordToggle = profile.querySelector('[data-password-toggle]');
    const cancel = passwordForm.querySelector('[data-password-cancel]');
    const passwordMessage = passwordForm.querySelector('[data-password-message]');
    const submit = passwordForm.querySelector('button[type="submit"]');

    function closePasswordForm() {
      passwordForm.reset();
      setMessage(passwordMessage, '');
      passwordForm.hidden = true;
      passwordToggle.setAttribute('aria-expanded', 'false');
      passwordToggle.focus();
    }
    passwordToggle.addEventListener('click', () => {
      if (!passwordForm.hidden) return closePasswordForm();
      passwordForm.hidden = false;
      passwordToggle.setAttribute('aria-expanded', 'true');
      passwordForm.elements.currentPassword.focus();
    });
    cancel.addEventListener('click', closePasswordForm);
    passwordForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (passwordForm.hidden || submit.disabled) return;
      submit.disabled = cancel.disabled = passwordToggle.disabled = true;
      setMessage(passwordMessage,'');
      const payload=Object.fromEntries(new FormData(passwordForm).entries());
      try {
        await A.request('/users/me',{method:'PUT',body:JSON.stringify(payload)});
        passwordForm.reset();
        setMessage(passwordMessage,'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.');
        location.assign('/login?reason=password-changed');
      } catch(err) {
        setMessage(passwordMessage,err.message,true);
      } finally {
        submit.disabled = cancel.disabled = passwordToggle.disabled = false;
      }
    });
    (async () => {
      try {
        const user=await A.request('/users/me');
        profile.querySelector('[data-profile-name]').textContent=user.name;
        profile.querySelector('[data-profile-email]').textContent=user.email;
        profile.querySelector('[data-profile-created]').textContent=user.created_at?new Date(user.created_at).toLocaleDateString('vi-VN'):'—';
        profile.querySelector('.profile-loading').hidden=true;
        profile.querySelector('.profile-content').hidden=false;
      } catch(err) {
        setMessage(message, `${err.message} — Vui lòng đăng nhập để xem tài khoản.`, true);
        profile.querySelector('.profile-loading').innerHTML='<a href="/login" class="button button-dark">Đăng nhập →</a>';
      }
      profile.querySelector('[data-logout]')?.addEventListener('click', async () => { try { await A.request('/users/logout',{method:'POST',body:JSON.stringify({})}); location.assign('/'); } catch(err) { setMessage(message,err.message,true); } });
    })();
  }

  const checkout = document.querySelector('[data-checkout-page]');
  if (checkout) (async () => {
    const message=checkout.querySelector('[data-checkout-message]'), button=checkout.querySelector('[data-place-order]');
    const items=checkout.querySelector('[data-checkout-items]');
    let ownerId, storageKey, pendingKey, coupon, savedOffer, loaded=false;
    button.disabled=true;
    function newKey() {
      const bytes=window.crypto.getRandomValues(new Uint8Array(16));
      bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
      const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
    try {
      const user=await A.request('/users/me'); ownerId=user.id;
      storageKey=`moc-checkout:${ownerId}`;
      pendingKey=window.sessionStorage.getItem(storageKey);
      if (pendingKey) savedOffer = JSON.parse(window.sessionStorage.getItem(storageKey + ':offer') || 'null');
      const rows=await A.request('/cart');
      if (items) items.innerHTML = rows.map(row => basketRow(row, false)).join('') || '<p class="shop-status">Giỏ hàng đang trống.</p>';
      const total=rows.reduce((n,p)=>n+Number(p.price)*Number(p.quantity),0);
      checkout.querySelector('[data-checkout-count]').textContent=`${rows.reduce((n,p)=>n+Number(p.quantity),0)} món`;
      checkout.querySelector('[data-checkout-subtotal]').textContent=A.money(total);
      checkout.querySelector('[data-checkout-total]').textContent=A.money(total);
      loaded=true;
      button.disabled=!rows.length&&!pendingKey;
      coupon = window.MocCommerce?.checkoutCoupon(checkout, total, rows.length > 0, pendingKey, savedOffer);
      if(pendingKey){button.textContent='Kiểm tra lại đơn hàng →';setMessage(message,'Lần đặt trước chưa được xác nhận. Bấm thử lại để hoàn tất; nếu đã thành công, hệ thống sẽ trả lại đơn cũ.');}
      else if(!rows.length){setMessage(message,'Giỏ hàng đang trống. Hãy chọn vài món trước nhé.');}
    } catch(err){
      if (items) items.innerHTML = err.status === 401 ? '<a class="shop-cta" href="/login">Đăng nhập để đặt hàng →</a>' : '';
      setMessage(message,`${err.message} — Không thể chuẩn bị thanh toán. Vui lòng tải lại trang.`,true);
    }
    button.addEventListener('click',async()=>{
      if(!loaded||button.disabled)return;
      button.disabled=true;button.textContent='Đang kiểm tra đơn…';
      coupon?.lock(true);
      try{
        const user=await A.request('/users/me');
        if(user.id!==ownerId)throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại trang.');
        if(!pendingKey){
          const key=newKey();
          savedOffer=coupon?.offer() || null;
          window.sessionStorage.setItem(storageKey + ':offer', JSON.stringify(savedOffer));
          window.sessionStorage.setItem(storageKey,key);
          pendingKey=key;
        }
        await A.request('/orders',{method:'POST',headers:{'Idempotency-Key':pendingKey},body:JSON.stringify(
          savedOffer ? {coupon:savedOffer.code,expected_total:savedOffer.total} : {}
        )});
        // Remove only after a definitive success. Network/5xx failures retain the
        // same key across retry, reload and cart changes in this browser tab.
        try{window.sessionStorage.removeItem(storageKey);window.sessionStorage.removeItem(storageKey + ':offer');}catch{}
        location.assign('/orders');
      }catch(err){
        if (savedOffer && [400,409,422].includes(err.status)) {
          window.sessionStorage.removeItem(storageKey);
          window.sessionStorage.removeItem(storageKey + ':offer');
          pendingKey=null;
          savedOffer=null;
          coupon?.reset();
        }
        if (!pendingKey) coupon?.lock(false);
        setMessage(message,`${err.message}${pendingKey?' — Bấm thử lại để kiểm tra cùng lần đặt hàng.':''}`,true);
        button.disabled=false;button.textContent=pendingKey?'Kiểm tra lại đơn hàng →':'Xác nhận đặt hàng →';
      }
    });
  })();


  const adminProducts=document.querySelector('[data-admin-products]');
  if(adminProducts) {
    const target=adminProducts.querySelector('[data-admin-product-list]');
    const message=adminProducts.querySelector('[data-admin-message]');
    const form=adminProducts.querySelector('[data-product-form]');
    const toggle=adminProducts.querySelector('[data-toggle-product-form]');
    const categorySelect=adminProducts.querySelector('[data-category-select]');
    const submitButton=form.querySelector('[type="submit"]');
    let editingId=null, editingRevision=null;
    const renderProducts=async()=>{
      try {
        const rows=await A.request('/products');
        target.innerHTML=rows.map(p=>`<div class="admin-product">${shopImage(p)}<span>${A.escape(p.name)}</span><b>${A.money(p.price)}</b><small>Còn ${A.escape(p.stock)} món</small><div class="admin-product-actions-row"><button type="button" data-variants-product="${p.id}" data-product-name="${A.escape(p.name)}">Biến thể</button><button type="button" data-edit-product="${p.id}" data-revision="${A.escape(p.revision)}" data-name="${A.escape(p.name)}" data-description="${A.escape(p.description||'')}" data-price="${p.price}" data-stock="${p.stock}" data-size="${A.escape(p.size||'')}" data-color="${A.escape(p.color||'')}" data-category="${p.category_id||''}">Sửa</button><button type="button" data-delete-product="${p.id}">Xoá</button></div></div>`).join('')||'<p>Chưa có sản phẩm.</p>';
      } catch(err) { setMessage(message,err.message,true); }
    };
    renderProducts();
    adminProducts.addEventListener('moc:inventory-updated',renderProducts);
    A.request('/categories').then(rows=>{
      categorySelect.innerHTML='<option value="">Không phân loại</option>'+rows.map(c=>`<option value="${A.escape(c.id)}">${A.escape(c.name)}</option>`).join('');
    }).catch(err=>{ setMessage(message,`Không thể tải danh mục: ${err.message}`,true); });
    const openForm=()=>{ form.hidden=false; toggle.setAttribute('aria-expanded','true'); form.querySelector('[name="name"]').focus(); };
    const closeForm=()=>{ form.reset(); form.hidden=true; toggle.setAttribute('aria-expanded','false'); editingId=null; editingRevision=null; submitButton.textContent='Lưu sản phẩm →'; };
    toggle.addEventListener('click',()=>{ if(!form.hidden){ closeForm(); return; } editingId=null; openForm(); });
    adminProducts.querySelector('[data-cancel-product-form]').addEventListener('click',closeForm);
    target.addEventListener('click', async e => {
      const editBtn=e.target.closest('[data-edit-product]');
      const delBtn=e.target.closest('[data-delete-product]');
      if (editBtn) {
        form.reset();
        editingId=editBtn.dataset.editProduct;
        editingRevision=editBtn.dataset.revision;
        form.elements.name.value=editBtn.dataset.name;
        form.elements.description.value=editBtn.dataset.description;
        form.elements.price.value=editBtn.dataset.price;
        form.elements.stock.value=editBtn.dataset.stock;
        form.elements.size.value=editBtn.dataset.size;
        form.elements.color.value=editBtn.dataset.color;
        form.elements.category_id.value=editBtn.dataset.category;
        submitButton.textContent='Cập nhật sản phẩm →';
        openForm();
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (delBtn) {
        if (!confirm('Xoá sản phẩm này? Hành động không thể hoàn tác.')) return;
        try { await A.request(`/products/${delBtn.dataset.deleteProduct}`,{method:'DELETE'}); setMessage(message,'Đã xoá sản phẩm.'); await renderProducts(); }
        catch(err) { setMessage(message,err.message,true); }
      }
    });
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      submitButton.disabled=true; setMessage(message,'');
      const payload=new FormData(form);
      if(!payload.get('category_id')) payload.delete('category_id');
      if(editingId) payload.set('revision', editingRevision);
      try {
        if (editingId) {
          await A.request(`/products/${editingId}`,{method:'PUT',body:payload});
          setMessage(message,'Đã cập nhật sản phẩm.');
        } else {
          await A.request('/products',{method:'POST',body:payload});
          setMessage(message,'Đã thêm sản phẩm.');
        }
        closeForm();
        await renderProducts();
      } catch(err) {
        setMessage(message, err.status === 409 && editingId ? 'Sản phẩm hoặc tồn kho đã thay đổi. Nội dung đang nhập được giữ lại. Bấm Sửa trong danh sách mới để tải dữ liệu hiện tại và kiểm tra trước khi lưu lại.' : err.message, true);
        if(err.status === 409 && editingId) await renderProducts();
      }
      finally { submitButton.disabled=false; }
    });
  }
})();

