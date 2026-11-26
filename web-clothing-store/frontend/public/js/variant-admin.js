document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('[data-admin-products]');
  if (!root) return;
  const api = window.MocApi;
  const dialog = root.querySelector('[data-variant-dialog]');
  const form = dialog.querySelector('form');
  const rows = form.querySelector('[data-variant-rows]');
  const status = form.querySelector('[data-variant-status]');
  const add = form.querySelector('[data-variant-new]');
  const save = form.querySelector('[type=submit]');
  let productId, revision;
  const setStatus = (message, error=false) => {
    status.textContent=message;
    status.classList.toggle('is-error',error);
  };
  function appendRow(variant={size:'',color:'',stock:0}) {
    const row = document.createElement('fieldset');
    const original = variant.id != null;
    const base = variant.id===0;
    if (original) row.dataset.id=variant.id;
    row.innerHTML = `<legend>${base?'Biến thể gốc':original?'Biến thể':'Biến thể mới'}</legend>
      <label>Cỡ<input data-size maxlength="50" ${original?'readonly':'required'}></label>
      <label>Màu<input data-color maxlength="50" ${original?'readonly':'required'}></label>
      <label>Tồn kho<input data-stock type="number" min="0" max="2147483647" step="1" required></label>
      ${base?'':'<button type="button" class="member-logout" data-remove>Gỡ</button>'}`;
    row.querySelector('[data-size]').value=variant.size || '';
    row.querySelector('[data-color]').value=variant.color || '';
    row.querySelector('[data-stock]').value=variant.stock;
    rows.append(row);
    return row;
  }
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-variants-product]');
    if (!button) return;
    const id = button.dataset.variantsProduct;
    productId=id; revision=null;
    form.querySelector('[data-variant-name]').textContent=button.dataset.productName;
    setStatus('Đang tải tồn kho…');
    rows.replaceChildren();
    add.disabled=save.disabled=true;
    dialog.showModal();
    try {
      const data=await api.request('/products/'+id+'/variants');
      if (!dialog.open || productId!==id) return;
      revision=data.revision;
      data.variants.forEach(appendRow);
      setStatus('');
      add.disabled=save.disabled=false;
    } catch(error){if(dialog.open && productId===id) setStatus(error.message,true);}
  });
  add.onclick=()=>appendRow().querySelector('[data-size]').focus();
  rows.onclick=event=>{if(event.target.closest('[data-remove]')) event.target.closest('fieldset').remove();};
  form.querySelector('[data-variant-cancel]').onclick=()=>dialog.close();
  form.onsubmit=async event=>{
    event.preventDefault();
    if (!revision || save.disabled) return;
    const variants = Array.from(rows.children,row=>({
      ...(row.dataset.id==null?{}:{id:Number(row.dataset.id)}),
      size:row.querySelector('[data-size]').value, color:row.querySelector('[data-color]').value,
      stock:row.querySelector('[data-stock]').valueAsNumber
    }));
    form.inert=true;
    dialog.oncancel=event=>event.preventDefault();
    try {
      await api.request('/products/'+productId+'/variants',{method:'PUT',body:JSON.stringify({revision,variants})});
      dialog.close();
      const notice=root.querySelector('[data-admin-message]');
      notice.textContent='Đã cập nhật biến thể và tồn kho.';
      notice.classList.remove('is-error');
      root.dispatchEvent(new CustomEvent('moc:inventory-updated'));
    } catch(error){setStatus(error.message,true);}
    finally {form.inert=false;dialog.oncancel=null;}
  };
});
