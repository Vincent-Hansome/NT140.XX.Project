(() => {
  const api = window.MocApi;
  const e = api.escape;
  const labels = {pending:'Đã đặt hàng',paid:'Đã thanh toán',confirmed:'Đã xác nhận',packing:'Đang đóng gói',shipped:'Đang giao hàng',delivered:'Giao thành công',cancelled:'Đã hủy'};
  const transitions = {pending:'confirmed',paid:'confirmed',confirmed:'packing',packing:'shipped',shipped:'delivered'};
  const actions = {confirmed:'Xác nhận đơn',packing:'Bắt đầu đóng gói',shipped:'Bàn giao vận chuyển',delivered:'Xác nhận đã giao'};
  const decisions = {pending:'Chờ duyệt',approved:'Đã chấp thuận',rejected:'Đã từ chối'};
  const date = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa ghi nhận thời điểm';
  const number = id => 'MC-' + String(id).padStart(5,'0');
  const write = (url, method, body, headers) => api.request(url,{method,headers,body:JSON.stringify(body)});
  const empty = message => '<p class="shop-status">' + e(message) + '</p>';

  function checkoutCoupon(root, subtotal, hasItems, pending, saved) {
    const form = root.querySelector('[data-coupon-form]');
    const place = root.querySelector('[data-place-order]');
    const remove = form.querySelector('[data-clear-coupon]');
    const display = form.querySelector('[data-coupon-message]');
    const input = form.elements.code;
    let applied = saved || null;
    function lock(locked) {
      for (const control of form.elements) control.disabled = locked;
    }
    function show() {
      root.querySelector('[data-discount-line]').hidden = !applied;
      root.querySelector('[data-discount]').textContent = applied ? '−' + api.money(applied.discount) : '';
      root.querySelector('[data-checkout-total]').textContent = api.money(applied ? applied.total : subtotal);
      if (applied) root.querySelector('[data-checkout-subtotal]').textContent = api.money(applied.subtotal);
      remove.hidden = !input.value.trim();
    }
    function reset() {
      applied = null; input.value = ''; display.textContent = ''; lock(false); show();
      root.querySelector('[data-checkout-subtotal]').textContent = api.money(subtotal);
      place.disabled = !hasItems;
    }
    form.hidden = !hasItems && !saved;
    input.value = saved?.code || '';
    show(); lock(Boolean(pending));
    input.addEventListener('input', () => {
      applied = null; display.textContent = ''; show();
      place.disabled = !hasItems || Boolean(input.value.trim());
    });
    remove.addEventListener('click', reset);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (input.disabled) return;
      if (!input.value.trim()) return reset();
      lock(true); place.disabled = true; applied = null;
      try {
        const quote = await write('/orders/coupon-preview','POST',{code:input.value});
        if (Number(quote.subtotal) !== subtotal) throw new Error('Giỏ hàng đã thay đổi. Hãy tải lại trang trước khi đặt hàng.');
        applied = quote; input.value = quote.code;
        display.textContent = 'Đã áp dụng mã ' + quote.code + '.';
      } catch (err) { display.textContent = err.message; }
      finally { lock(false); show(); place.disabled = !applied; }
    });
    return {offer:() => applied, lock, reset};
  }
  window.MocCommerce = {checkoutCoupon};

  function returnForm(item, available) {
    if (available <= 0) return '';
    return `<details class="commerce-return"><summary>Yêu cầu đổi hoặc trả</summary>
      <form class="commerce-grid" data-return-item="${e(item.id)}">
        <label>Hình thức <select name="kind"><option value="exchange">Đổi hàng</option><option value="return">Trả hàng</option></select></label>
        <label>Số lượng <input name="quantity" type="number" min="1" max="${e(available)}" value="1" required></label>
        <label class="commerce-wide">Lý do <textarea name="reason" maxlength="1000" required></textarea></label>
        <button type="submit">Gửi yêu cầu</button><p role="status"></p>
      </form></details>`;
  }
  function detailMarkup(data, activity) {
    const id = data.order.id;
    const timeline = activity.timeline.map(event => `<li><strong>${e(labels[event.status] || event.status)}</strong>
      <span>${e(date(event.created_at))}</span></li>`).join('');
    const items = data.items.map(item => {
      const requests = activity.returns.filter(r => r.order_item_id === item.id);
      const used = requests.filter(r => r.status !== 'rejected').reduce((sum,r) => sum + Number(r.quantity),0);
      const returns = requests.map(r => `<p>${r.kind==='exchange'?'Đổi':'Trả'} ${e(r.quantity)} · ${e(decisions[r.status])} · ${e(r.reason)}</p>`).join('');
      const image = api.image(item.image_url);
      const variant = [item.variant_color,item.variant_size].filter(Boolean).join(' · ');
      const completed = data.order.status === 'delivered';
      return `<div class="commerce-order-item"><div class="order-item">
        ${image ? '<img src="'+e(image)+'" alt="" loading="lazy">' : '<span></span>'}
        <span><a href="/products/${e(item.product_id)}">${e(item.name)}</a> <small>× ${e(item.quantity)}${variant ? ' · '+e(variant) : ''}</small></span>
        <b>${e(api.money(Number(item.price)*item.quantity))}</b></div>
        ${returns}${completed ? '<a class="commerce-review" href="/products/'+e(item.product_id)+'#reviews">Đánh giá sản phẩm</a>'+returnForm(item,Number(item.quantity)-used) : ''}</div>`;
    }).join('');
    const discount = activity.discount;
    return `<div class="commerce-detail"><section><h3>Tiến trình đơn hàng</h3><ol class="commerce-timeline">${timeline}</ol>
      <a class="commerce-review" href="/support?order=${e(id)}">Liên hệ hỗ trợ về đơn này</a></section>
      <section><h3>Sản phẩm đã đặt</h3>${items}
      ${discount ? '<p>Tạm tính '+e(api.money(discount.subtotal))+' · Mã '+e(discount.code)+' giảm '+e(api.money(discount.discount))+'</p>' : ''}
      <p><b>Tổng cộng · ${e(api.money(data.order.total))}</b></p></section></div>`;
  }
  async function customerOrders(root) {
    const list = root.querySelector('[data-orders-list]');
    const message = root.querySelector('[data-orders-message]');
    async function fill(panel, id) {
      const [data,activity] = await Promise.all([api.request('/orders/'+id),api.request('/orders/'+id+'/activity')]);
      panel.innerHTML = detailMarkup(data,activity);
      panel.dataset.loaded='true';
    }
    try {
      const orders = await api.request('/orders');
      if (!orders.length) {
        list.innerHTML = '<div class="empty-state"><p>Bạn chưa có đơn hàng nào.</p><a class="button button-dark" href="/products">Khám phá bộ sưu tập</a></div>';
        return;
      }
      list.innerHTML = orders.map(o => `<article class="order-row" id="order-${e(o.id)}"><button type="button" class="order-head"
        aria-controls="order-detail-${e(o.id)}" aria-expanded="false" data-order-id="${e(o.id)}">
        <span><small class="eyebrow">MÃ ĐƠN</small><b>${e(number(o.id))}</b></span>
        <span><small class="eyebrow">NGÀY ĐẶT</small><b>${e(date(o.created_at))}</b></span>
        <span><small class="eyebrow">TRẠNG THÁI</small><b>${e(labels[o.status] || o.status)}</b></span>
        <strong>${e(api.money(o.total))}</strong><span aria-hidden="true">⌄</span></button>
        <div class="order-detail" id="order-detail-${e(o.id)}" hidden></div></article>`).join('');
      list.addEventListener('click',async event => {
        const button = event.target.closest('[data-order-id]');
        if (!button) return;
        const panel = document.getElementById(button.getAttribute('aria-controls'));
        panel.hidden = !panel.hidden;
        button.setAttribute('aria-expanded',String(!panel.hidden));
        if (panel.hidden || panel.dataset.loaded || panel.dataset.loading) return;
        panel.dataset.loading='true';
        panel.textContent='Đang tải chi tiết…';
        try { await fill(panel,button.dataset.orderId); } catch(err) { panel.textContent=err.message; }
        finally { delete panel.dataset.loading; }
      });
      list.addEventListener('submit',async event => {
        const form=event.target.closest('[data-return-item]');
        if (!form) return;
        event.preventDefault();
        const submit=form.querySelector('[type=submit]');
        if (submit.disabled) return;
        const panel=form.closest('.order-detail'), id=panel.closest('article').querySelector('[data-order-id]').dataset.orderId;
        const values=Object.fromEntries(new FormData(form));
        if (!form.dataset.key) {
          const bytes=window.crypto.getRandomValues(new Uint8Array(16));
          bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
          const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
          form.dataset.key=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
        }
        submit.disabled=true;
        try {
          await write('/orders/'+id+'/returns','POST',{...values,item_id:Number(form.dataset.returnItem),quantity:Number(values.quantity)}, {'Idempotency-Key':form.dataset.key});
          await fill(panel,id);
        } catch(err) {form.querySelector('[role=status]').textContent=err.message;submit.disabled=false;}
      });
      const openHash = () => {
        const id = /^#order-(\d+)$/.exec(location.hash)?.[1];
        if (!id) return;
        const row=document.getElementById('order-'+id);
        const btn=row?.querySelector('[data-order-id]');
        if (btn && btn.getAttribute('aria-expanded')==='false') btn.click();
        row?.scrollIntoView();
      };
      window.addEventListener('hashchange',openHash);openHash();
    } catch(err) {
      message.textContent=err.message;
      list.innerHTML=err.status===401 ? '<a class="button button-dark" href="/login">Đăng nhập để xem đơn hàng</a>' : '';
    }
  }

  function couponRow(c) {
    const value = c.discount_type === 'percent' ? Number(c.amount)+'%' : api.money(c.amount);
    return `<article><div><strong>${e(c.code)}</strong> · ${e(value)}
      <p>Đơn từ ${e(api.money(c.minimum_total))} · ${e(c.used_count)}/${e(c.use_limit)} lượt · Đến ${e(date(c.expires_at))}</p></div>
      <button type="button" data-coupon-id="${e(c.id)}" data-active="${c.active?'0':'1'}">${c.active?'Tạm dừng':'Kích hoạt'}</button></article>`;
  }
  function returnRow(r) {
    return `<article><div><strong>${e(number(r.order_id))} · ${e(r.name)}</strong>
      <p>${e(r.email)} · ${r.kind==='exchange'?'Đổi':'Trả'} ${e(r.quantity)} · ${e(decisions[r.status])}</p>
      <p>${e(r.reason)}</p></div>${r.status==='pending' ? '<div class="commerce-inline"><button data-return-id="'+e(r.id)+'" data-status="approved">Chấp thuận</button><button data-return-id="'+e(r.id)+'" data-status="rejected">Từ chối</button></div>' : ''}</article>`;
  }
  function adminOrder(o) {
    const next=transitions[o.status];
    return `<article class="order-row"><div class="order-head admin-order-head">
      <span><small class="eyebrow">MÃ ĐƠN</small><b>${e(number(o.id))}</b></span>
      <span><small class="eyebrow">KHÁCH HÀNG</small><b>${e(o.customer_name)}</b><small>${e(o.customer_email)}</small></span>
      <span><small class="eyebrow">NGÀY ĐẶT</small><b>${e(date(o.created_at))}</b></span>
      <span><small class="eyebrow">TRẠNG THÁI</small><b>${e(labels[o.status] || o.status)}</b></span>
      <strong>${e(api.money(o.total))}</strong></div>
      ${next ? '<button class="commerce-advance" type="button" data-advance="'+e(o.id)+'" data-status="'+e(next)+'">'+e(actions[next])+'</button>' : ''}</article>`;
  }
  async function admin(root) {
    const message=root.querySelector('[data-admin-orders-message]');
    const form=root.querySelector('[data-create-coupon]');
    const couponMessage=root.querySelector('[data-coupon-result]');
    const list=root.querySelector('[data-admin-orders-list]');
    let orderCursor=null;
    async function loadOrders(append=false) {
      const rows=await api.request('/orders/admin/all'+(append?'?before='+orderCursor:''));
      const markup=rows.map(adminOrder).join('');
      if (append) list.insertAdjacentHTML('beforeend',markup);
      else list.innerHTML=markup || empty('Chưa có đơn hàng.');
      orderCursor=rows.at(-1)?.id;
      root.querySelector('[data-more-orders]').hidden=rows.length<500;
    }
    function pager(kind,row,emptyText) {
      const region=root.querySelector('[data-admin-'+kind+']');
      const more=root.querySelector('[data-more-'+kind+']');
      let cursor;
      async function load(append=false) {
        const result=await api.request('/orders/admin/'+kind+(append?'?before='+cursor:''));
        const markup=result.items.map(row).join('');
        if (append) region.insertAdjacentHTML('beforeend',markup);
        else region.innerHTML=markup || empty(emptyText);
        cursor=result.next;more.hidden=!cursor;
      }
      more.addEventListener('click',async()=>{
        more.disabled=true;
        try {await load(true);} catch(err){message.textContent=err.message;} finally{more.disabled=false;}
      });
      return load;
    }
    const coupons=pager('coupons',couponRow,'Chưa có mã giảm giá.');
    const returns=pager('returns',returnRow,'Chưa có yêu cầu đổi trả.');
    try {
      await loadOrders();
      root.querySelector('[data-commerce-admin]').hidden=false;
      root.querySelector('[data-commerce-nav]').hidden=false;
      await Promise.all([coupons(),returns()]);
    } catch(err) { message.textContent=err.message; if(!orderCursor)list.textContent=''; }
    root.addEventListener('click',async event=>{
      const button=event.target.closest('[data-advance],[data-return-id],[data-coupon-id],[data-more-orders]');
      if (!button || button.disabled) return;
      button.disabled=true; message.textContent='';
      try {
        const d=button.dataset;
        if (d.advance) {
          await write('/orders/admin/'+d.advance+'/status','PATCH',{status:d.status});
          const article=button.closest('article'), next=transitions[d.status];
          article.querySelector('.admin-order-head > span:nth-child(4) b').textContent=labels[d.status];
          if (next) {button.dataset.status=next;button.textContent=actions[next];}
          else button.remove();
        } else if (d.returnId) {
          await write('/orders/admin/returns/'+d.returnId,'PATCH',{status:d.status});
          await returns();
        } else if (d.couponId) {
          await write('/orders/admin/coupons/'+d.couponId,'PATCH',{active:d.active==='1'});
          await coupons();
        } else await loadOrders(true);
      } catch(err){message.textContent=err.message;} finally{button.disabled=false;}
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=form.querySelector('[type=submit]');
      if (button.disabled) return;
      button.disabled=true;
      try {
        const values=Object.fromEntries(new FormData(form));
        const result=await write('/orders/admin/coupons','POST',{...values,use_limit:Number(values.use_limit),expires_at:new Date(values.expires_at).toISOString()});
        form.reset();couponMessage.textContent='Đã tạo mã '+result.code+'.';await coupons();
      }catch(err){couponMessage.textContent=err.message;}finally{button.disabled=false;}
    });
  }
  const orders=document.querySelector('[data-orders-page]');
  if (orders) customerOrders(orders);
  const management=document.querySelector('[data-admin-orders]');
  if (management) admin(management);
})();
