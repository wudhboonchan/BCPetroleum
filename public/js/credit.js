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
    // Set default date for credit form using Flatpickr API if available
    const today = DateUtils.getTodayString();
    const dateInput = document.getElementById('creditDate');
    if (dateInput) {
        const fpInstance = dateInput._flatpickr;
        if (fpInstance) {
            fpInstance.setDate(today, true);
        } else {
            dateInput.value = today;
        }
    }
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

        // Check for last selected customer
        const lastCustomerId = localStorage.getItem('lastCreditCustomerId');
        if (lastCustomerId) {
            customerSelect.value = lastCustomerId;
            filterSelect.value = ""; // Don't auto-filter by customer, just select in add form
            // But if we want to filter by default? No, the requirement is for adding.

            // Trigger change event to set notes/validation
            handleCustomerChange();

            // Optional: Focus on Book No if customer is auto-selected on load? 
            // Requirement says: "loading the page with a remembered customer -> cursor to ... field"
            setTimeout(() => {
                const billBookInput = document.getElementById('billBook');
                if (billBookInput) billBookInput.focus();
            }, 100);
        }

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

        // Get all unpaid (Fix: Use /filter endpoint to get ALL unpaid, including invoiced ones)
        const unpaid = await API.get('/api/credit/filter', { paid: 'false' });
        const unpaidTotal = unpaid.summary?.totalAmount || 0;
        const unpaidCount = unpaid.summary?.totalBills || 0;

        document.getElementById('unpaidTotal').textContent = '฿' + NumberUtils.formatNumber(unpaidTotal);
        document.getElementById('unpaidCount').textContent = unpaidCount + ' รายการ';

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

        tbody.innerHTML = credits.map((credit, index) => {
            const customer = customers.find(c => c.id === credit.customer_id);
            const customerName = customer ? customer.name : 'ไม่ทราบ';
            const creator = credit.users ? (credit.users.name || credit.users.username) : 'System';

            return `
                <tr>
                    <td style="text-align: center; color: var(--text-secondary);">${index + 1}</td>
                    <td>${customerName}</td>
                    <td>${credit.bill_book}-${credit.bill_number}</td>
                    <td>${credit.vehicle_number || '-'}</td>
                    <td><strong>฿${NumberUtils.formatNumber(credit.amount)}</strong></td>
                    <td><span class="badge" style="background: #f1f5f9; color: #475569; font-weight: normal;">${creator}</span></td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                            ${!credit.paid
                    ? `<button class="btn btn-sm btn-primary" onclick="editCredit(${credit.id})">แก้ไข</button>`
                    : ''}
                            <button class="btn btn-sm btn-danger" onclick="deleteCredit(${credit.id})">ลบ</button>
                        </div>
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
        const invNum = sale.invoices?.invoice_number;
        return `
            <div class="compact-badge-container">
                <span class="badge badge-success">🟢 จ่ายแล้ว</span>
                ${invNum ? `<span class="invoice-number-text" style="cursor: pointer; text-decoration: underline; color: #059669; font-weight: bold; margin-left: 4px;" onclick="showInvoiceDetails('${sale.invoice_id}')" title="ดูรายละเอียดใบวางบิล">${invNum}</span>` : ''}
            </div>
        `;
    } else if (sale.invoice_status === 'invoiced' || sale.invoice_id) {
        const invNum = sale.invoices?.invoice_number || '';
        const invId = sale.invoice_id || sale.invoices?.id;
        return `<span class="badge" style="background: #f59e0b; color: white; cursor: pointer;" onclick="showInvoiceDetails('${invId}')" title="ดูรายละเอียดใบวางบิล">🟡 ${invNum}</span>`;
    } else {
        return `<span class="badge badge-warning">🔴 ยังไม่ได้วางบิล</span>`;
    }
}

// Show invoice details modal (Copied from customers.js)
window.showInvoiceDetails = async function (invoiceId) {
    try {
        Loading.show();
        const result = await API.get(`/api/invoices/${invoiceId}`);
        const invoice = result.invoice;
        Loading.hide();

        if (!invoice) {
            Toast.error('ไม่พบข้อมูลใบวางบิล');
            return;
        }

        const customer = invoice.customers;
        const bills = invoice.bills || [];

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'invoice-detail-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;
        `;

        const billsHtml = bills.map((bill, index) => `
            <tr>
                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd;">${DateUtils.formatThaiDate(bill.date)}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: center;">${bill.bill_book}-${bill.bill_number}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: center;">${bill.vehicle_number || '-'}</td>
                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;"><strong>฿${NumberUtils.formatNumber(bill.amount)}</strong></td>
            </tr>
        `).join('');

        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 1rem; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                    <div>
                        <h2 style="margin: 0; color: #2D3E50;">ใบวางบิล ${invoice.invoice_number}</h2>
                        <p style="margin: 0.5rem 0 0; color: #666;">วันที่ออกใบวางบิล: ${DateUtils.formatThaiDate(invoice.issue_date)}</p>
                    </div>
                    <span style="background: ${invoice.status === 'paid' ? '#d1fae5' : '#fef3c7'}; color: ${invoice.status === 'paid' ? '#065f46' : '#92400e'}; padding: 0.4rem 1rem; border-radius: 999px; font-size: 0.9rem; font-weight: 600;">
                        สถานะ: ${invoice.status === 'paid' ? 'ชำระแล้ว' : 'ค้างชำระ'}
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; background: #f8f9fa; padding: 1rem; border-radius: 0.75rem; margin-bottom: 1.5rem;">
                    <div>
                        <div style="color: #666; font-size: 0.9rem;">ลูกค้า</div>
                        <div style="font-weight: bold;">${customer?.name || '-'}</div>
                    </div>
                    <div>
                        <div style="color: #666; font-size: 0.9rem;">จำนวนบิล</div>
                        <div style="font-weight: bold;">${bills.length} รายการ</div>
                    </div>
                    <div>
                        <div style="color: #666; font-size: 0.9rem;">ยอดรวม</div>
                        <div style="font-weight: bold; font-size: 1.2rem; color: #f59e0b;">฿${NumberUtils.formatNumber(invoice.total_amount)}</div>
                    </div>
                </div>

                <h3 style="margin: 0 0 1rem; color: #2D3E50;">รายการบิล</h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #e3e3e3;">
                                <th style="padding: 0.75rem; border: 1px solid #ddd; text-align: center;">#</th>
                                <th style="padding: 0.75rem; border: 1px solid #ddd;">วันที่</th>
                                <th style="padding: 0.75rem; border: 1px solid #ddd; text-align: center;">เล่ม/เลขที่</th>
                                <th style="padding: 0.75rem; border: 1px solid #ddd; text-align: center;">ทะเบียนรถ</th>
                                <th style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">ยอดเงิน (฿)</th>
                            </tr>
                        </thead>
                        <tbody>${billsHtml}</tbody>
                        <tfoot>
                            <tr style="background: #f8f9fa; font-weight: bold;">
                                <td colspan="4" style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">รวมทั้งสิ้น</td>
                                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right; font-size: 1.1rem; color: #f59e0b;">฿${NumberUtils.formatNumber(invoice.total_amount)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div style="display: flex; gap: 0.5rem; margin-top: 2rem; justify-content: flex-end; flex-wrap: wrap;">
                    <button class="btn btn-secondary" onclick="document.getElementById('invoice-detail-modal').remove()">ปิด</button>
                    ${invoice.status !== 'paid' ? `
                        <button class="btn btn-warning" onclick="cancelInvoice(${invoiceId}); document.getElementById('invoice-detail-modal').remove();">ยกเลิกใบวางบิล</button>
                        <button class="btn btn-success" onclick="payInvoiceFromCredit('${invoiceId}')">ชำระเงิน</button>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    } catch (error) {
        Loading.hide();
        console.error('Show invoice details error:', error);
        Toast.error('เกิดข้อผิดพลาดในการแสดงรายละเอียด');
    }
}

window.payInvoiceFromCredit = async function (invoiceId) {
    if (typeof Swal === 'undefined') return;

    const today = new Date().toISOString().split('T')[0];

    const { value: formValues } = await Swal.fire({
        title: '<span style="color: #1e293b; font-weight: bold;">ระบุช่องทางการชำระเงินและวันที่</span>',
        html: `
            <div style="text-align: left; margin-top: 15px;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">วันที่ชำระเงิน <span style="color: #ef4444;">*</span></label>
                <input type="date" id="swal-payment-date" class="form-control" style="width: 100%; padding: 0.6rem; border: 1px solid #d1d5db; border-radius: 0.5rem; margin-bottom: 1rem;" value="${today}">

                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">ช่องทางการชำระเงิน <span style="color: #ef4444;">*</span></label>
                <div style="display: flex; gap: 20px; justify-content: center; margin-top: 10px;">
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 1.1rem;">
                        <input type="radio" name="swal-payment-method" value="transfer" checked style="transform: scale(1.2);">
                        <span>เงินโอน 📲</span>
                    </label>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 1.1rem;">
                        <input type="radio" name="swal-payment-method" value="cash" style="transform: scale(1.2);">
                        <span>เงินสด 💵</span>
                    </label>
                </div>
            </div>
        `,
        background: '#ffffff',
        color: '#334155',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
            const paymentDate = document.getElementById('swal-payment-date').value;
            const selectedMethod = document.querySelector('input[name="swal-payment-method"]:checked');

            if (!paymentDate) {
                Swal.showValidationMessage('กรุณาระบุวันที่ชำระเงิน');
                return false;
            }
            if (!selectedMethod) {
                Swal.showValidationMessage('กรุณาเลือกช่องทางการชำระเงิน');
                return false;
            }

            return { paymentMethod: selectedMethod.value, paymentDate };
        }
    });

    if (formValues) {
        try {
            Loading.show();
            await API.post(`/api/invoices/${invoiceId}/pay`, {
                payment_method: formValues.paymentMethod,
                payment_date: formValues.paymentDate
            });
            Loading.hide();
            Toast.success('บันทึกการชำระเงินเรียบร้อยแล้ว');
            document.getElementById('invoice-detail-modal')?.remove();
            await loadSummary();
            await loadAllCredits();
        } catch (error) {
            Loading.hide();
            console.error('Payment error:', error);
            Toast.error(error.message || 'ไม่สามารถบันทึกการชำระเงินได้');
        }
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
                        ${credit.invoice_id && credit.invoice_status !== 'paid'
                ? `<button class="btn btn-sm btn-warning" onclick="cancelInvoice(${credit.invoice_id})">ถอนใบวาง</button>`
                : ''}
                        <button class="btn btn-sm btn-danger" onclick="deleteCredit(${credit.id})">ลบ</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Calculate total amount for the current view
    const totalAmount = creditsToShow.reduce((sum, credit) => sum + parseFloat(credit.amount || 0), 0);

    // Add footer row
    tbody.innerHTML += `
        <tr style="background-color: #f8fafc; border-top: 2px solid #e2e8f0; font-size: 0.95rem;">
            <td colspan="5" style="text-align: right; padding: 0.5rem 1rem !important; color: var(--text-secondary); font-weight: 600;">รวมยอดที่แสดง:</td>
            <td style="color: var(--primary); font-weight: 700; font-size: 1.1rem; padding: 0.5rem 1rem !important;">฿${NumberUtils.formatCurrency(totalAmount)}</td>
            <td colspan="3" style="padding: 0.5rem 1rem !important;"></td>
        </tr>
    `;

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

    // CHECK: Prevent creating new invoice if one already exists
    try {
        Loading.show();
        const checkResult = await API.get('/api/invoices', { customer_id: customerId, status: 'active' });
        Loading.hide();

        if (checkResult && checkResult.invoices && checkResult.invoices.length > 0) {
            const activeInv = checkResult.invoices[0];
            Modal.confirm(
                'ไม่สามารถสร้างใบวางบิลได้',
                `<div style="text-align: left;">
                    ลูกค้า <strong>${customer.name}</strong> มีใบวางบิลที่รอดำเนินการอยู่แล้ว<br>
                    <div style="background: #fff1f2; color: #9f1239; padding: 0.8rem; border-radius: 0.5rem; margin-top: 0.8rem; margin-bottom: 0.8rem; border: 1px solid #fda4af; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.5rem;">📄</span>
                        <div>
                            <div style="font-weight: bold;">${activeInv.invoice_number}</div>
                            <div style="font-size: 0.9rem;">ยอดเงิน: ฿${NumberUtils.formatCurrency(activeInv.total_amount)}</div>
                        </div>
                    </div>
                    <small style="color: #64748b; line-height: 1.5; display: block;">
                        ระบบอนุญาตให้มีใบวางบิลที่รอดำเนินการเพียง 1 ใบต่อลูกค้า<br>
                        • หากต้องการรวมยอด: กรุณา <strong>ยกเลิกใบวางบิลเดิม</strong> ก่อน<br>
                        • หรือดำเนินการชำระเงินใบวางบิลเดิมให้เสร็จสิ้น
                    </small>
                </div>`,
                () => { }
            );
            return;
        }
    } catch (error) {
        Loading.hide();
        console.error('Check active invoice error:', error);
        // Continue but warn? Or return?
        // Let's assume network error -> block to be safe or allow?
        // Blocking might annoy if API is down. But safeguarding data is improved.
        Toast.error('ไม่สามารถตรวจสอบสถานะใบวางบิลได้ กรุณาลองใหม่');
        return;
    }

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
        date: document.getElementById('creditDate').value,
        customer_id: parseInt(document.getElementById('customerId').value),
        bill_book: document.getElementById('billBook').value.trim(),
        bill_number: document.getElementById('billNumber').value.trim(),
        amount: parseFloat(document.getElementById('amount').value),
        vehicle_number: document.getElementById('vehicleNumber').value.trim() || null,
        note: document.getElementById('note').value.trim() || null
    };

    if (!formData.date) {
        Toast.error('กรุณาระบุวันที่');
        return;
    }

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
        await API.post('/api/credit', formData); // Changed from /api/customer to /api/credit
        Loading.hide();
        Toast.success('บันทึกรายการเรียบร้อย');

        // Remember the customer ID
        localStorage.setItem('lastCreditCustomerId', formData.customer_id);

        // Reset form but keep date as today or selected? Usually keep today
        // const currentSelectedDate = document.getElementById('creditDate').value;
        document.getElementById('creditForm').reset();

        // Restore date because reset clears it
        // document.getElementById('creditDate').value = currentSelectedDate; 
        // Or just reset to TODAY everytime? 
        // User might want to enter multiple for same past date.
        // Let's keep the date that was selected!

        // Restore date using Flatpickr API so the visible display also updates
        const creditDateEl = document.getElementById('creditDate');
        const fpInstance = creditDateEl._flatpickr;
        const dateToRestore = formData.date || DateUtils.getTodayString();
        if (fpInstance) {
            fpInstance.setDate(dateToRestore, true); // true = trigger change event
        } else {
            creditDateEl.value = dateToRestore; // fallback if Flatpickr not loaded
        }

        // Restore customer selection
        document.getElementById('customerId').value = formData.customer_id;
        handleCustomerChange(); // Update any UI related to customer change (e.g. required notes)

        // Focus on Book No field
        setTimeout(() => {
            document.getElementById('billBook').focus();
        }, 100);

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
                    <div class="form-group">
                        <label class="form-label">วันที่ *</label>
                        <input type="date" id="editCreditDate" class="form-control" value="${credit.date ? credit.date.split('T')[0] : ''}" required>
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
                date: document.getElementById('editCreditDate').value,
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
