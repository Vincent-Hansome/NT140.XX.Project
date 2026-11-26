(() => {
  const api = window.MocApi;
  const badge = document.querySelector('[data-notification-count]');
  if (badge) api.request('/notifications/unread').then(({unread}) => {
    badge.textContent = unread ? unread + ' chưa đọc' : '↗';
  }).catch(() => {});

  function showError(status,error) {
    status.textContent = error.message;
    if (error.status===401) {
      const link = document.createElement('a');
      link.href = '/login'; link.textContent = 'Đăng nhập';
      status.append(' · ',link);
    }
  }
  const inbox = document.querySelector('[data-notifications]');
  if (inbox) {
    const list = inbox.querySelector('[data-inbox]'), more = inbox.querySelector('[data-more]'), status = inbox.querySelector('[data-status]');
    const states = {pending:'Chờ xác nhận',paid:'Đã thanh toán',confirmed:'Đã xác nhận',packing:'Đang đóng gói',shipped:'Đang giao',delivered:'Đã giao',cancelled:'Đã hủy'};
    let before;
    async function load() {
      more.disabled = true;
      try {
        const page = await api.request('/notifications' + (before ? '?before='+before : ''));
        for (const item of page.items) {
          const li = document.createElement('li'), link = document.createElement('a'), title = document.createElement('strong'), time = document.createElement('small');
          const order = item.kind==='order';
          link.href = order ? '/orders#order-'+item.entity_id : '/support#ticket-'+item.entity_id;
          title.textContent = order ? 'Đơn #'+item.entity_id+' · '+(states[item.order_status] || item.order_status) : 'Có phản hồi cho yêu cầu hỗ trợ #'+item.entity_id;
          time.textContent = (item.read_at ? 'Đã đọc' : 'Chưa đọc')+' · '+new Date(item.created_at).toLocaleString('vi-VN');
          link.append(title,time); li.append(link); list.append(li);
          link.addEventListener('click',async event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            try {
              if (!item.read_at) await api.request('/notifications/'+item.id+'/read',{method:'PATCH'});
              window.location.assign(link.href);
            } catch(error) { showError(status,error); }
          });
        }
        before=page.nextCursor; more.hidden=!before;
        status.textContent=list.children.length ? '' : 'Bạn chưa có thông báo.';
      } catch(error) { showError(status,error); } finally { more.disabled=false; }
    }
    more.addEventListener('click',load); load();
  }
  const report=document.querySelector('[data-sales-report]');
  if (report) {
    const form=report.querySelector('form'), status=report.querySelector('[data-status]'), results=report.querySelector('[data-result]');
    const today = new Date(Date.now()+7*3600*1000).toISOString().slice(0,10);
    form.elements.to.value=today;
    form.elements.from.value=today.slice(0,8)+'01';
    function rows(target, items, colspan, empty) {
      target.innerHTML=items.length ? items.join('') : '<tr><td colspan="'+colspan+'">'+empty+'</td></tr>';
    }
    const product = row => '<td><a href="/products/'+encodeURIComponent(row.id)+'">'+api.escape(row.name)+'</a></td>';
    async function load() {
      const button=form.querySelector('button');
      button.disabled=true; results.hidden=true; status.textContent='Đang tải báo cáo…';
      try {
        const data=await api.request('/reports/sales?'+new URLSearchParams(new FormData(form)));
        report.querySelector('[data-sales]').textContent=api.money(data.summary.revenue);
        report.querySelector('[data-order-count]').textContent=data.summary.orders;
        rows(report.querySelector('[data-sellers]'),data.products.map(row=>'<tr>'+product(row)+'<td>'+api.escape(row.quantity)+'</td></tr>'),2,'Chưa có sản phẩm giao thành công trong kỳ.');
        rows(report.querySelector('[data-stock]'),data.stock.map(row=>'<tr>'+product(row)+'<td>'+api.escape([row.size,row.color].filter(Boolean).join(' / ') || 'Mặc định')+'</td><td>'+api.escape(row.stock)+'</td></tr>'),3,'Tất cả biến thể còn trên 5 sản phẩm.');
        results.hidden=false; status.textContent='';
      } catch(error) { showError(status,error); } finally { button.disabled=false; }
    }
    form.addEventListener('submit',event=>{event.preventDefault(); load();}); load();
  }
})();
