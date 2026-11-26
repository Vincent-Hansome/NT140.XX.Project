(() => {
  const root = document.querySelector('[data-support-customer], [data-support-admin]');
  if (!root) return;
  const api = window.MocApi;
  const admin = root.hasAttribute('data-support-admin');
  const endpoint = admin ? '/support/admin/tickets' : '/support/tickets';
  const list = root.querySelector('[data-support-list]');
  const content = root.querySelector('[data-support-content]');
  const pageMessage = root.querySelector('[data-support-page-message]');
  const listMessage = root.querySelector('[data-support-list-message]');
  const more = root.querySelector('[data-support-more]');
  const refresh = root.querySelector('[data-support-refresh]');
  const form = root.querySelector('[data-support-form]');
  const labels = { open: 'Đã tiếp nhận', in_progress: 'Đang xử lý', resolved: 'Đã giải quyết' };
  let nextCursor = null;
  let loading = false;
  const params = new URLSearchParams(location.search);
  const ticketTarget = location.hash.match(/^#ticket-([1-9]\d*)$/)?.[1] || params.get('ticket');
  let openedTarget = false;

  async function loadOrders() {
    const select = form.elements.order_id;
    try {
      const orders = await api.request('/orders');
      for (const order of orders) {
        const option = element('option', '', `MC-${String(order.id).padStart(5,'0')} · ${date(order.created_at)}`);
        option.value = order.id;
        select.append(option);
      }
      if (orders.some(order => String(order.id) === params.get('order'))) select.value = params.get('order');
    } catch (error) {
      if (error.status !== 401) feedback(root.querySelector('[data-support-order-note]'), 'Chưa tải được danh sách đơn hàng.', true);
    }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    // All ticket/customer/reply content is plain text, including HTML-like input.
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function feedback(node, text, error = false) {
    node.textContent = text;
    node.classList.toggle('is-error', error);
    node.setAttribute('role', error ? 'alert' : 'status');
  }
  function date(value) {
    const parsed = new Date(value);
    return value && !Number.isNaN(parsed.valueOf()) ? parsed.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '';
  }
  function showAuthentication(error) {
    if (error.status !== 401 && error.status !== 403) return false;
    content.hidden = true;
    root.querySelector('[data-support-signin]').hidden = false;
    feedback(pageMessage, admin ? 'Bạn cần quyền quản trị để xem hộp thư hỗ trợ.' : 'Bạn cần đăng nhập để sử dụng hỗ trợ.', true);
    return true;
  }
  function ticketCard(ticket) {
    const card = element('details', 'support-ticket');
    card.dataset.ticketId = ticket.id;
    const summary = element('summary');
    const top = element('span', 'support-ticket-top');
    const badge = element('span', `support-status support-status-${Object.hasOwn(labels, ticket.status) ? ticket.status : 'open'}`, labels[ticket.status] || 'Đã tiếp nhận');
    top.append(element('span', 'support-ticket-id', `HT-${String(ticket.id).padStart(5, '0')}`), badge);
    summary.append(top, element('span', 'support-ticket-subject', ticket.subject));
    const meta = element('span', 'support-ticket-meta', date(ticket.created_at));
    if (admin) meta.append(element('span', '', `${ticket.customer_name} · ${ticket.customer_email}`));
    summary.append(meta);
    const body = element('div', 'support-ticket-content');
    if (ticket.order_id) meta.append(element('span', '', `Đơn MC-${String(ticket.order_id).padStart(5, '0')}`));
    body.append(element('strong', 'support-message-author', 'Khách hàng'), element('p', 'support-ticket-body', ticket.message));
    const history = element('div', 'support-thread');
    const historyError = element('p', 'support-feedback');
    body.append(history, historyError);
    let historyVersion = 0;
    async function loadThread() {
      const version = ++historyVersion;
      try {
        const messages = await api.request(`${endpoint}/${ticket.id}/messages`);
        if (version !== historyVersion) return;
        history.replaceChildren(...messages.map(row => {
          const item = element('article', 'support-ticket-reply');
          item.append(element('h3', '', row.sender_role === 'admin' ? 'MỘC · Hỗ trợ' : 'Khách hàng'),
            element('p', 'support-ticket-reply-text', row.body), element('time', '', date(row.created_at)));
          return item;
        }));
        feedback(historyError, '');
      } catch (error) {
        if (version === historyVersion) feedback(historyError, error.message, true);
      }
    }
    card.id = `ticket-${ticket.id}`;
    card.addEventListener('toggle', () => { if (card.open) loadThread(); });
    const editor = element('form', 'support-form support-admin-form');
    let status;
    if (admin) {
      const label = element('label', '', 'Trạng thái xử lý');
      label.htmlFor = `support-status-${ticket.id}`;
      status = element('select');
      status.id = label.htmlFor;
      for (const [value, title] of Object.entries(labels)) {
        const option = element('option', '', title);
        option.value = value;
        status.append(option);
      }
      status.value = ticket.status;
      editor.append(label, status);
    }
    const label = element('label', '', admin ? 'Phản hồi cho khách hàng' : 'Trả lời MỘC');
    label.htmlFor = `support-reply-${ticket.id}`;
    const input = element('textarea');
    input.id = label.htmlFor;
    input.rows = 3;
    input.maxLength = 4000;
    input.required = !admin;
    const message = element('p', 'support-feedback');
    const buttonLabel = admin ? 'Lưu phản hồi' : 'Gửi tin nhắn';
    const save = element('button', 'button button-dark', buttonLabel);
    save.type = 'submit';
    editor.append(label, input, message, save);
    editor.addEventListener('submit', async event => {
      event.preventDefault();
      if (save.disabled || !editor.reportValidity()) return;
      const text = input.value.trim();
      if (!admin && !text) return feedback(message, 'Nhập tin nhắn muốn gửi.', true);
      const payload = admin ? { status: status.value } : { message: text };
      if (admin && text) payload.reply = text;
      save.disabled = true;
      feedback(message, '');
      try {
        const result = await api.request(`${endpoint}/${ticket.id}${admin ? '' : '/messages'}`, {
          method: admin ? 'PATCH' : 'POST', body: JSON.stringify(payload)
        });
        ticket.status = result.status;
        badge.textContent = labels[ticket.status];
        badge.className = `support-status support-status-${ticket.status}`;
        input.value = '';
        await loadThread();
        feedback(message, admin ? 'Đã lưu cập nhật hỗ trợ.' : 'Đã gửi tin nhắn.');
      } catch (error) {
        if (!showAuthentication(error)) feedback(message, error.message, true);
      } finally { save.disabled = false; }
    });
    body.append(editor);
    card.append(summary, body);
    return card;
  }

  async function load(append = false) {
    if (loading) return;
    loading = true;
    more.disabled = true;
    refresh.disabled = true;
    list.setAttribute('aria-busy', 'true');
    feedback(listMessage, 'Đang tải yêu cầu…');
    try {
      const data = await api.request(`${endpoint}${append && nextCursor ? `?before=${encodeURIComponent(nextCursor)}` : ''}`);
      feedback(listMessage, '');
      if (!append) list.replaceChildren();
      for (const ticket of data.tickets) {
        if (!document.getElementById(`ticket-${ticket.id}`)) list.append(ticketCard(ticket));
      }
      if (!admin && !openedTarget && /^[1-9]\d*$/.test(ticketTarget || '')) {
        openedTarget = true;
        let card = document.getElementById(`ticket-${ticketTarget}`);
        if (!card) {
          try { card = ticketCard(await api.request(`${endpoint}/${ticketTarget}`)); list.prepend(card); }
          catch (error) { feedback(listMessage, error.message, true); }
        }
        if (card) { card.open = true; requestAnimationFrame(() => card.scrollIntoView({block:'nearest'})); }
      }
      if (!append && !data.tickets.length) list.append(element('p', 'support-empty', admin ? 'Chưa có yêu cầu hỗ trợ nào.' : 'Bạn chưa có yêu cầu nào. Gửi lời nhắn đầu tiên để MỘC hỗ trợ bạn.'));
      nextCursor = data.nextCursor;
      more.hidden = !nextCursor;
      content.hidden = false;
      root.querySelector('[data-support-signin]').hidden = true;
      feedback(pageMessage, '');
    } catch (error) {
      if (!showAuthentication(error)) {
        content.hidden = false;
        feedback(pageMessage, '');
        feedback(listMessage, `${error.message} Bạn có thể bấm Làm mới để thử lại.`, true);
      }
    } finally {
      loading = false;
      more.disabled = false;
      refresh.disabled = false;
      list.setAttribute('aria-busy', 'false');
    }
  }

  more.addEventListener('click', () => load(true));
  refresh.addEventListener('click', () => load());
  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const message = form.querySelector('[data-support-form-message]');
    if (button.disabled || !form.reportValidity()) return;
    const subject = form.elements.subject.value.trim();
    const body = form.elements.message.value.trim();
    if (!subject || !body) {
      feedback(message, 'Vui lòng nhập tiêu đề và nội dung hỗ trợ.', true);
      (!subject ? form.elements.subject : form.elements.message).focus();
      return;
    }
    button.disabled = true;
    button.textContent = 'Đang gửi…';
    feedback(message, '');
    try {
      const payload = { subject, message: body };
      if (form.elements.order_id.value) payload.order_id = form.elements.order_id.value;
      const result = await api.request(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      feedback(message, `Đã gửi yêu cầu HT-${String(result.id).padStart(5, '0')}. Bạn có thể theo dõi phản hồi bên dưới.`);
      await load();
    } catch (error) {
      if (!showAuthentication(error)) feedback(message, error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Gửi yêu cầu →';
    }
  });
  if (form) loadOrders();
  load();
})();
