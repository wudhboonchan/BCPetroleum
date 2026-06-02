// Credit Management JavaScript with Invoice Support
Auth.requireAuth();

let customers = [];
let allCreditsData = [];
let currentPage = 1;
let rowsPerPage = 10;
let selectedBills = new Set(); // Track selected bill IDs

// Load user info
function loadUserInfo() {
    const user = Auth.getCurrentUser();
    if (user) {
        document.getElementById('userName').textContent = user.name || user.username;
        document.getElementById('userRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน';
        document.getElementById('userAvatar').textContent = user.name ? user.name[0].toUpperCase() : 'U';
    }
}

// Update date
function updateDate() {
    document.getElementById('currentDate').textContent = DateUtils.getThaiDate();
}

// Load customers for dropdown
async function loadCustomers() {
    try {
        const data = await API.get('/api/customer');
        customers = data.data || [];

        const customerSelect = document.getElementById('customerId');
        const filterSelect = document.getElementById('filterCustomer');

        customerSelect.innerHTML = '<option value="">เลือกลูกค้า</option>';
        filterSelect.innerHTML = '<option value="">ทั้งหมด</option>';

        customers.forEach(customer => {
            const option = `<option value="${customer.id}">${customer.name}</option>`;
            customerSelect.innerHTML += option;
            filterSelect.innerHTML += option;
        });

        // Add event listener for customer change
        customerSelect.addEventListener('change', handleCustomerChange);
        
    } catch (error) {
        console.error('Error loading customers:', error);
        Toast.error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
    }
}

// Handle customer change for validation
function handleCustomerChange() {
    const customerId = parseInt(document.getElementById('customerId').value);
    const customer = customers.find(c => c.id === customerId);
    const noteInput = document.getElementById('note');
    const noteLabel = document.querySelector('label[for="note"]');
    
    // Check if customer is K01 or Retail (รายย่อย)
    // Assuming 'K01' might be in code, or just checking name for 'รายย่อย'
    const isRetail = customer && (
        (customer.code && customer.code.toUpperCase() === 'K01') || 
        customer.name.includes('รายย่อย') ||
        customer.name.includes('K01')
    );

    if (isRetail) {
        noteInput.required = true;
        if (noteLabel) noteLabel.innerHTML = 'หมายเหตุ <span style="color: #EF4444;">* (ระบุชื่อลูกค้า)</span>';
        noteInput.placeholder = 'ระบุชื่อลูกค้า...';
    } else {
        noteInput.required = false;
        if (noteLabel) noteLabel.textContent = 'หมายเหตุ';
        noteInput.placeholder = '';
    }
}

// Load summary stats
async function loadSummary() {
    try {
        // Get today's sales
        const today = await API.get('/api/credit/today');
        const todayData = today.data || [];
        const todayTotal = todayData.reduce((sum, item) => sum + parseFloat(item.amount), 0);

        document.getElementById('todayTotal').textContent = '฿' + NumberUtils.formatNumber(todayTotal);
        document.getElementById('todayCount').textContent = todayData.length + ' รายการ';

        // Get all unpaid
        const all = await API.get('/api/credit/sales', { invoice_status: 'unpaired' });
        const unpaidData = all.sales || [];
        const unpaidTotal = unpaidData.reduce((sum, item) => sum + parseFloat(item.amount), 0);

        document.getElementById('unpaidTotal').textContent = '฿' + NumberUtils.formatNumber(unpaidTotal);
        document.getElementById('unpaidCount').textContent = unpaidData.length + ' รายการ';

        // Get this month's paid
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const paid = await API.get('/api/credit/sales', {
            invoice_status: 'paid',
            start_date: firstDay.toISOString().split('T')[0],
            end_date: lastDay.toISOString().split('T')[0]
        });
        const paidData = paid.sales || [];
        const paidTotal = paidData.reduce((sum, item) => sum + parseFloat(item.amount), 0);

        document.getElementById('paidTotal').textContent = '฿' + NumberUtils.formatNumber(paidTotal);
        document.getElementById('paidCount').textContent = paidData.length + ' รายการ';
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

// Load today's credit sales
async function loadTodayCredits() {
    try {
        const data = await API.get('/api/credit/today');
        const credits = data.data || [];

        const tbody = document.getElementById('todayListBody');

        if (credits.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        ไม่มีรายการขายเชื่อวันนี้
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = credits.map(credit => {
            const time = new Date(credit.created_at).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit'
            });
            const customer = customers.find(c => c.id === credit.customer_id);
            const customerName = customer ? customer.name : 'ไม่ทราบ';

            return `
                <tr>
                    <td>${time}</td>
                    <td>${customerName}</td>
                    <td>${credit.bill_book}-${credit.bill_number}</td>
                    <td>${credit.vehicle_number || '-'}</td>
                    <td><strong>฿${NumberUtils.formatNumber(credit.amount)}</strong></td>
                    <td>
                        ${credit.paid
                    ? '<span class="badge badge-success">ชำระแล้ว</span>'
                    : '<span class="badge badge-warning">ยังไม่ชำระ</span>'}
                    </td>
                    <td>
                        ${!credit.paid
                    ? `<button class="btn btn-sm btn-primary" onclick="editCredit(${credit.id})" style="margin-right: 0.5rem;">แก้ไข</button>`
                    : ''}
                        <button class="btn btn-sm btn-danger" onclick="deleteCredit(${credit.id})" style="margin-left: 0.5rem;">ลบ</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading today credits:', error);
        Toast.error('ไม่สามารถโหลดรายการวันนี้ได้');
    }
}

// Load all credits with filters (UPDATED to use /sales endpoint)
async function loadAllCredits() {
    try {
        Loading.show();

        const params = {};

        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;
        const customerId = document.getElementById('filterCustomer').value;
        const status = document.getElementById('filterStatus').value;

        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        if (customerId) params.customer_id = customerId;
        if (status) params.invoice_status = status;

        const data = await API.get('/api/credit/sales', params);
        allCreditsData = data.sales || [];
        currentPage = 1;
        selectedBills.clear();

        renderTable();
        updateInvoiceButtons();
        Loading.hide();
    } catch (error) {
        Loading.hide();
        console.error('Error loading all credits:', error);
        Toast.error('ไม่สามารถโหลดรายการได้');
    }
}

// Get invoice status badge
function getInvoiceStatusBadge(sale) {
    if (sale.invoice_status === 'paid') {
        return `<span class="badge badge-success">🟢 จ่ายแล้ว ${sale.invoices?.invoice_number || ''}</span>`;
    } else if (sale.invoice_status === 'invoiced') {
        return `<span class="badge" style="background: #f59e0b; color: white;">🟡 วางบิลแล้ว ${sale.invoices?.invoice_number || ''}</span>`;
    } else {
        return `<span class="badge badge-warning">🔴 ยังไม่ได้วางบิล</span>`;
    }
}

// Render Table with Pagination (UPDATED with checkbox and invoice status)
function renderTable() {
    const tbody = document.getElementById('allListBody');
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const creditsToShow = allCreditsData.slice(start, end);

    const showingEntry = document.getElementById('showingEntry');
    if (allCreditsData.length > 0) {
        showingEntry.textContent = `แสดง ${start + 1} ถึง ${Math.min(end, allCreditsData.length)} จาก ${allCreditsData.length} รายการ`;
    } else {
        showingEntry.textContent = '';
    }

    if (allCreditsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    ไม่พบรายการตามเงื่อนไขที่เลือก
                </td>
            </tr>
        `;
        renderPagination();
        return;
    }

    tbody.innerHTML = creditsToShow.map(credit => {
        const date = DateUtils.formatThaiDate(credit.date);
        const customer = customers.find(c => c.id === credit.customer_id);
        const customerName = customer ? customer.name : 'ไม่ทราบ';
        const canSelect = credit.invoice_status === 'unpaired';

        return `
            <tr>
                <td style="text-align: center;">
                    ${canSelect
                ? `<input type="checkbox" class="bill-checkbox" data-bill-id="${credit.id}" data-customer-id="${credit.customer_id}" ${selectedBills.has(credit.id) ? 'checked' : ''}>`
                : '-'}
                </td>
                <td>${date}</td>
                <td>${customerName}</td>
                <td>${credit.bill_book}-${credit.bill_number}</td>
                <td>${credit.vehicle_number || '-'}</td>
                <td><strong>฿${NumberUtils.formatNumber(credit.amount)}</strong></td>
                <td>${getInvoiceStatusBadge(credit)}</td>
                <td>${credit.note || '-'}</td>
                <td>
                    <div class="invoice-actions">
                        ${credit.invoice_status === 'unpaired'
                    ? `<button class="btn btn-sm btn-primary" onclick="editCredit(${credit.id})">แก้ไข</button>`
                    : ''}
                        ${credit.invoice_status === 'invoiced' && credit.invoice_id
                    ? `<button class="btn btn-sm btn-warning" onclick="cancelInvoice(${credit.invoice_id})">ยกเลิกใบวางบิล</button>`
                    : ''}
                        <button class="btn btn-sm btn-danger" onclick="deleteCredit(${credit.id})">ลบ</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Attach checkbox event listeners
    document.querySelectorAll('.bill-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });

    renderPagination();
}

// Handle checkbox change
function handleCheckboxChange(e) {
    const billId = parseInt(e.target.dataset.billId);
    if (e.target.checked) {
        selectedBills.add(billId);
    } else {
        selectedBills.delete(billId);
    }
    updateInvoiceButtons();
}

// Select all unpaired bills
function selectAllUnpaired() {
    const unpaidBills = allCreditsData.filter(c => c.invoice_status === 'unpaired');
    unpaidBills.forEach(bill => selectedBills.add(bill.id));
    renderTable();
    updateInvoiceButtons();
}

// Clear selection
function clearSelection() {
    selectedBills.clear();
    renderTable();
    updateInvoiceButtons();
}

// Update invoice button states
function updateInvoiceButtons() {
    const createBtn = document.getElementById('createInvoiceBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const clearBtn = document.getElementById('clearSelectionBtn');
    const selectedCount = document.getElementById('selectedCount');

    if (createBtn) createBtn.disabled = selectedBills.size === 0;
    if (selectAllBtn) selectAllBtn.disabled = allCreditsData.filter(c => c.invoice_status === 'unpaired').length === 0;
    if (clearBtn) clearBtn.disabled = selectedBills.size === 0;
    if (selectedCount) selectedCount.textContent = `เลือกแล้ว ${selectedBills.size} รายการ`;
}

// Create invoice from selected bills
async function createInvoice() {
    if (selectedBills.size === 0) {
        Toast.error('กรุณาเลือกบิลอย่างน้อย 1 รายการ');
        return;
    }

    // Get selected bills data
    const selectedBillsData = allCreditsData.filter(c => selectedBills.has(c.id));

    // Check all bills belong to same customer
    const customerIds = [...new Set(selectedBillsData.map(b => b.customer_id))];
    if (customerIds.length > 1) {
        Toast.error('บิลที่เลือกต้องเป็นของลูกค้าคนเดียวกันทั้งหมด');
        return;
    }

    const customerId = customerIds[0];
    const customer = customers.find(c => c.id === customerId);
    const totalAmount = selectedBillsData.reduce((sum, b) => sum + parseFloat(b.amount), 0);

    // Show confirmation modal
    Modal.confirm(
        'ยืนยันการสร้างใบวางบิล',
        `สร้างใบวางบิลสำหรับ: ${customer?.name || 'ไม่ทราบ'}<br>
        จำนวนบิล: ${selectedBills.size} รายการ<br>
        ยอดรวม: ฿${NumberUtils.formatCurrency(totalAmount)}<br><br>
        ต้องการดำเนินการต่อหรือไม่?`,
        async () => {
            try {
                Loading.show();
                const result = await API.post('/api/invoices', {
                    customer_id: customerId,
                    credit_sale_ids: Array.from(selectedBills),
                    issue_date: new Date().toISOString().split('T')[0]
                });
                Loading.hide();
                Toast.success(result.message || 'สร้างใบวางบิลสำเร็จ');
                selectedBills.clear();
                await loadSummary();
                await loadAllCredits();
            } catch (error) {
                Loading.hide();
                console.error('Create invoice error:', error);
                Toast.error(error.message || 'ไม่สามารถสร้างใบวางบิลได้');
            }
        }
    );
}

// Cancel invoice and return bills to unpaired
async function cancelInvoice(invoiceId) {
    try {
        // Get invoice details first
        Loading.show();
        const invoiceData = await API.get(`/api/invoices/${invoiceId}`);
        Loading.hide();

        const invoice = invoiceData.invoice;
        const billCount = invoice.bills?.length || 0;

        Modal.confirm(
            'ยืนยันการยกเลิกใบวางบิล',
            `ต้องการยกเลิกใบวางบิล ${invoice.invoice_number} หรือไม่?<br>
            ลูกค้า: ${invoice.customers?.name || 'ไม่ทราบ'}<br>
            จำนวนบิล: ${billCount} รายการ<br>
            ยอดรวม: ฿${NumberUtils.formatCurrency(invoice.total_amount)}<br><br>
            <strong>หมายเหตุ:</strong> บิลทั้งหมดจะกลับไปเป็นสถานะ "ยังไม่ได้วางบิล" และสามารถนำไปวางบิลใหม่ได้<br>
            เลข Invoice นี้จะถูกนำกลับมาใช้ใหม่เมื่อสร้าง Invoice ครั้งถัดไป`,
            async () => {
                try {
                    Loading.show();
                    const result = await API.post(`/api/invoices/${invoiceId}/cancel`);
                    Loading.hide();
                    Toast.success(result.message || 'ยกเลิกใบวางบิลสำเร็จ');
                    await loadSummary();
                    await loadAllCredits();
                } catch (error) {
                    Loading.hide();
                    console.error('Cancel invoice error:', error);
                    Toast.error(error.message || 'ไม่สามารถยกเลิกใบวางบิลได้');
                }
            }
        );
    } catch (error) {
        Loading.hide();
        console.error('Get invoice error:', error);
        Toast.error('ไม่สามารถโหลดข้อมูลใบวางบิลได้');
    }
}

// Render Pagination Controls
function renderPagination() {
    const totalPages = Math.ceil(allCreditsData.length / rowsPerPage);
    const container = document.getElementById('paginationControls');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.innerHTML = '❮';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => changePage(currentPage - 1);
    container.appendChild(prevBtn);

    const maxVisibleButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

    if (endPage - startPage + 1 < maxVisibleButtons) {
        startPage = Math.max(1, endPage - maxVisibleButtons + 1);
    }

    if (startPage > 1) {
        addPageButton(1, container);
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            container.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        addPageButton(i, container);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            container.appendChild(ellipsis);
        }
        addPageButton(totalPages, container);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.innerHTML = '❯';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => changePage(currentPage + 1);
    container.appendChild(nextBtn);
}

function addPageButton(page, container) {
    const btn = document.createElement('button');
    btn.className = `pagination-btn ${currentPage === page ? 'active' : ''}`;
    btn.textContent = page;
    btn.onclick = () => changePage(page);
    container.appendChild(btn);
}

function changePage(page) {
    if (page < 1 || page > Math.ceil(allCreditsData.length / rowsPerPage)) return;
    currentPage = page;
    renderTable();
}

// Clear filters
function clearFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterCustomer').value = '';
    document.getElementById('filterStatus').value = '';

    document.getElementById('allListBody').innerHTML = `
        <tr>
            <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                กดค้นหาเพื่อแสดงรายการ
            </td>
        </tr>
    `;
}

// Delete credit
async function deleteCredit(id) {
    Modal.confirm(
        'ยืนยันการลบ',
        'ต้องการลบรายการนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
        async () => {
            try {
                Loading.show();
                await API.delete(`/api/credit/${id}`);
                Loading.hide();
                Toast.success('ลบรายการเรียบร้อย');
                await loadSummary();
                await loadTodayCredits();
                await loadAllCredits();
            } catch (error) {
                Loading.hide();
                console.error('Error deleting credit:', error);
                Toast.error('ไม่สามารถลบรายการได้');
            }
        }
    );
}

// Submit credit form
document.getElementById('creditForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        customer_id: parseInt(document.getElementById('customerId').value),
        bill_book: document.getElementById('billBook').value.trim(),
        bill_number: document.getElementById('billNumber').value.trim(),
        amount: parseFloat(document.getElementById('amount').value),
        vehicle_number: document.getElementById('vehicleNumber').value.trim() || null,
        note: document.getElementById('note').value.trim() || null
    };

    if (!formData.customer_id) {
        Toast.error('กรุณาเลือกลูกค้า');
        return;
    }

    if (formData.amount <= 0) {
        Toast.error('ยอดเงินต้องมากกว่า 0');
        return;
    }

    Loading.show();

    try {
        await API.post('/api/customer', formData);
        Loading.hide();
        Toast.success('บันทึกรายการเรียบร้อย');

        document.getElementById('creditForm').reset();

        await loadSummary();
        await loadTodayCredits();
    } catch (error) {
        Loading.hide();
        console.error('Submit error:', error);
        Toast.error(error.message || 'ไม่สามารถบันทึกรายการได้');
    }
});

// Edit credit
async function editCredit(id) {
    try {
        const allData = await API.get('/api/credit/sales');
        const credit = allData.sales.find(c => c.id === id);

        if (!credit) {
            Toast.error('ไม่พบรายการนี้');
            return;
        }

        if (credit.invoice_status !== 'unpaired') {
            Toast.error('ไม่สามารถแก้ไขรายการที่ถูกผูกกับใบวางบิลแล้ว');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'edit-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const customerOptions = customers.map(c =>
            `<option value="${c.id}" ${c.id === credit.customer_id ? 'selected' : ''}>${c.name}</option>`
        ).join('');

        modal.innerHTML = `
            <div class="modal-dialog" style="background: white; padding: 2rem; border-radius: 1rem; max-width: 600px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                <h3>แก้ไขรายการขายเชื่อ</h3>
                <form id="editCreditForm" style="margin-top: 1.5rem;">
                    <div class="form-group">
                        <label class="form-label">ลูกค้า *</label>
                        <select id="editCustomerId" class="form-select" required>
                            ${customerOptions}
                        </select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label">เล่มที่ *</label>
                            <input type="text" id="editBillBook" class="form-control" value="${credit.bill_book}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">เลขที่ *</label>
                            <input type="text" id="editBillNumber" class="form-control" value="${credit.bill_number}" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">ยอดเงิน (฿) *</label>
                        <input type="number" id="editAmount" class="form-control" step="0.01" value="${credit.amount}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">ทะเบียนรถ</label>
                        <input type="text" id="editVehicleNumber" class="form-control" value="${credit.vehicle_number || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">หมายเหตุ</label>
                        <input type="text" id="editNote" class="form-control" value="${credit.note || ''}">
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" id="cancelEdit">ยกเลิก</button>
                        <button type="submit" class="btn btn-primary">บันทึก</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('cancelEdit').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        document.getElementById('editCreditForm').onsubmit = async (e) => {
            e.preventDefault();

            const formData = {
                customerId: parseInt(document.getElementById('editCustomerId').value),
                billBook: document.getElementById('editBillBook').value.trim(),
                billNumber: document.getElementById('editBillNumber').value.trim(),
                amount: parseFloat(document.getElementById('editAmount').value),
                vehicleNumber: document.getElementById('editVehicleNumber').value.trim() || null,
                note: document.getElementById('editNote').value.trim() || null
            };

            if (formData.amount <= 0) {
                Toast.error('ยอดเงินต้องมากกว่า 0');
                return;
            }

            Loading.show();

            try {
                await API.put(`/api/credit/${id}`, formData);
                Loading.hide();
                modal.remove();
                Toast.success('แก้ไขรายการเรียบร้อย');
                await loadSummary();
                await loadTodayCredits();
                await loadAllCredits();
            } catch (error) {
                Loading.hide();
                console.error('Edit error:', error);
                Toast.error(error.message || 'ไม่สามารถแก้ไขรายการได้');
            }
        };

    } catch (error) {
        console.error('Edit credit error:', error);
        Toast.error('เกิดข้อผิดพลาด');
    }
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    Modal.confirm(
        'ออกจากระบบ',
        'คุณต้องการออกจากระบบหรือไม่?',
        async () => {
            await Auth.logout();
        }
    );
});

// Rows per page change
document.getElementById('rowsPerPage').addEventListener('change', (e) => {
    rowsPerPage = parseInt(e.target.value);
    currentPage = 1;
    renderTable();
});

// Initialize
updateDate();
loadUserInfo();
loadCustomers().then(() => {
    loadSummary();
    loadTodayCredits();
});
