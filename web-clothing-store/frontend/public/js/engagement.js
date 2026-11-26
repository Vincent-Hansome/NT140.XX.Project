(() => {
  const api = window.MocApi;
  const wishlist = document.querySelector('[data-wishlist]');
  const saved = new Map();
  const productKey = value => String(value);
  function element(tag, label, className) {
    const node = document.createElement(tag);
    if (label != null) node.textContent = label;
    if (className) node.className = className;
    return node;
  }
  function updateButtons() {
    for (const button of document.querySelectorAll('[data-save-product]')) {
      const selected = saved.has(button.dataset.saveProduct);
      button.setAttribute('aria-pressed', String(selected));
      button.textContent = selected ? 'Đã yêu thích' : 'Yêu thích';
    }
  }
  function renderWishlist() {
    if (!wishlist) return;
    const list = wishlist.querySelector('[data-wishlist-list]');
    const status = wishlist.querySelector('[data-wishlist-status]');
    status.textContent = saved.size ? `${saved.size} sản phẩm đã lưu` : 'Bạn chưa lưu sản phẩm nào.';
    wishlist.querySelector('[data-wishlist-browse]').hidden = saved.size > 0;
    list.replaceChildren();
    for (const [id, product] of saved) {
      const article = element('article', null, 'favorite-card');
      const link = element('a');
      link.href = '/products/' + encodeURIComponent(id);
      if (product.image_url) {
        const image = element('img');
        image.src = api.image(product.image_url);
        image.alt = '';
        image.loading = 'lazy';
        link.append(image);
      }
      link.append(element('h2',product.name));
      const actions = element('div',null,'favorite-actions');
      const choose = element('a','Chọn sản phẩm');
      choose.href = link.href;
      const remove = element('button','Đã yêu thích','save-product');
      remove.type = 'button';
      remove.dataset.saveProduct = id;
      remove.setAttribute('aria-label','Bỏ lưu ' + product.name);
      actions.append(choose, remove);
      article.append(link,element('p',api.money(product.price)),actions);
      list.append(article);
    }
  }
  let guest = false;
  const ready = api.request('/wishlist').then(rows => {
    for (const row of rows) saved.set(productKey(row.id),row);
    renderWishlist();
    updateButtons();
  }).catch(err => {
    guest = err.status === 401;
    if (wishlist) {
      wishlist.querySelector('[data-wishlist-status]').textContent = guest ? 'Danh sách được lưu theo tài khoản.' : err.message;
      wishlist.querySelector('[data-wishlist-login]').hidden = !guest;
    }
  });
  document.addEventListener('moc:catalog-rendered', updateButtons);
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-save-product]');
    if (!button || button.disabled) return;
    button.disabled = true;
    await ready;
    const id = button.dataset.saveProduct;
    const selected = saved.has(id);
    try {
      if (guest) { location.assign('/login'); return; }
      await api.request('/wishlist/' + encodeURIComponent(id), {method: selected ? 'DELETE' : 'PUT'});
      if (selected) saved.delete(id);
      else saved.set(id, {id});
      if (wishlist) {
        renderWishlist();
        (wishlist.querySelector('[data-save-product]') || wishlist.querySelector('[data-wishlist-browse]')).focus();
      }
      updateButtons();
      button.parentElement?.querySelector('[data-save-message]')?.remove();
    } catch (err) {
      if (err.status === 401) { location.assign('/login'); return; }
      let msg = button.parentElement.querySelector('[data-save-message]');
      if (!msg) {
        msg = element('p',null,'form-message is-error');
        msg.dataset.saveMessage = '';
        msg.setAttribute('role','alert');
        button.after(msg);
      }
      msg.textContent = err.message;
    } finally { button.disabled = false; }
  });
  const root = document.querySelector('[data-product-reviews]');
  if (!root) return;
  const endpoint = '/products/' + encodeURIComponent(root.dataset.productReviews) + '/reviews';
  const list = root.querySelector('[data-review-list]');
  const summary = root.querySelector('[data-review-summary]');
  const hint = root.querySelector('[data-review-hint]');
  const more = root.querySelector('[data-review-more]');
  const form = root.querySelector('form');
  const feedback = root.querySelector('[data-review-feedback]');
  let cursor = null;
  async function loadReviews(append = false) {
    more.disabled = true;
    try {
      const data = await api.request(endpoint + (append ? '?before=' + cursor : ''));
      if (!append) list.replaceChildren();
      summary.textContent = data.total ? `${Number(data.average).toLocaleString('vi-VN')}/5 sao · ${data.total} đánh giá` : 'Chưa có đánh giá cho sản phẩm này.';
      for (const row of data.reviews) {
        const entry = element('article', null, 'review-entry');
        const timestamp = new Date(row.created_at).toLocaleDateString('vi-VN');
        entry.append(element('strong',row.author), element('p',row.body), element('small',`${row.rating}/5 sao · Đã mua hàng · ${timestamp}`));
        list.append(entry);
      }
      cursor = data.nextCursor;
      more.hidden = !cursor;
    } catch (err) { summary.textContent = err.message; }
    finally { more.disabled = false; }
  }
  async function loadEligibility() {
    try {
      const data = await api.request(endpoint + '/eligibility');
      form.hidden = !data.purchased || data.reviewed;
      hint.textContent = data.reviewed ? 'Bạn đã đánh giá sản phẩm này.' : data.purchased ? '' : 'Bạn có thể đánh giá sau khi đơn hàng được giao thành công.';
    } catch (err) {
      if (err.status === 401) {
        const login = element('a','Đăng nhập');
        login.href = '/login';
        hint.replaceChildren(login, ' để đánh giá sản phẩm đã mua.');
      } else hint.textContent = err.message;
    }
  }
  more.addEventListener('click', ()=>loadReviews(true));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const save = form.querySelector('button');
    if (save.disabled || !form.reportValidity()) return;
    save.disabled = true;
    try {
      await api.request(endpoint,{ method:'POST',body:JSON.stringify({rating:Number(form.elements.rating.value),body:form.elements.body.value.trim()}) });
      form.reset();
      form.hidden = true;
      hint.textContent = 'Bạn đã đánh giá sản phẩm này.';
      feedback.textContent = 'Đã đăng đánh giá.';
      await loadReviews();
    } catch (err) {
      feedback.textContent = err.message;
      if (err.status === 409) await loadEligibility();
    } finally { save.disabled = false; }
  });
  loadReviews();
  loadEligibility();
})();
