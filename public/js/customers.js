// Customers Management JavaScript V2
Auth.requireAuth();

// Global variables to ensure accessibility
window.allCustomers = [];
window.isEditing = false;
window.editingId = null;
window.currentCustomerName = '';
window.currentInvoiceNo = '';

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

// Load customers
async function loadCustomers() {
    try {
        Loading.show();

        // Fetch Customers AND Pending Invoices in parallel
        // Fetch Customers AND Invoices (Active + Pending)
        const [customerResult, pendingResult, activeResult] = await Promise.all([
            API.get('/api/customer'),
            API.get('/api/invoices', { status: 'pending' }),
            API.get('/api/invoices', { status: 'active' })
        ]);

        window.allCustomers = customerResult.data || [];

        // Build Active Invoice Map (Combine pending and active)
        window.activeInvoicesMap = {};
        const allOpenInvoices = [
            ...(pendingResult?.invoices || []),
            ...(activeResult?.invoices || [])
        ];

        allOpenInvoices.forEach(inv => {
            // If multiple exist (shouldn't happen), pick the most recent or simple overwrite
            window.activeInvoicesMap[inv.customer_id] = inv;
        });

        renderCustomerTable(window.allCustomers);
        Loading.hide();
    } catch (error) {
        Loading.hide();
        console.error('Load customers error:', error);
        Toast.error('ไม่สามารถโหลดข้อมูลลูกค้าได้');
    }
}

// Render customer table
function renderCustomerTable(customers) {
    const tbody = document.getElementById('customerListBody');
    tbody.innerHTML = '';

    if (customers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    ไม่พบข้อมูลลูกค้า
                </td>
            </tr>
        `;
        return;
    }

    customers.forEach(customer => {
        const unpaidText = customer.unpaidAmount > 0
            ? `<span style="color: #e11d48; font-weight: bold;">฿${NumberUtils.formatCurrency(customer.unpaidAmount)}</span>`
            : '<span style="color: #10b981; opacity: 0.8;">ไม่มียอดค้าง</span>';

        // Check unpaid
        const hasUnpaid = customer.unpaidAmount > 0;
        const currentUser = Auth.getCurrentUser();
        const isAdmin = currentUser && currentUser.role === 'admin';

        // Check for Active Invoice
        const activeInvoice = window.activeInvoicesMap[customer.id];

        // Invoice Button Logic
        let invoiceBtn = '';

        if (activeInvoice) {
            // CASE 1: Has Active Invoice -> Show PRIMARY Button (Consistent with other pages)
            // Using flex for multiple buttons
            invoiceBtn += `
                <button class="btn btn-sm btn-primary" style="margin-right: 0.5rem; box-shadow: var(--shadow-sm);" onclick="openInvoice('${customer.id}', '${activeInvoice.id}')" title="ดูใบวางบิล ${activeInvoice.invoice_number}">
                     📄 ${activeInvoice.invoice_number} (รอชำระ)
                </button>
            `;

            // CHECK FOR NEW UNBILLED ITEMS (Case 1.1)
            // If customer has more debt than the invoice amount, it means new items came in.
            const totalDebt = parseFloat(customer.unpaidAmount || 0);
            const invoiceAmount = parseFloat(activeInvoice.total_amount || 0);
            const unbilledAmount = totalDebt - invoiceAmount;

            // If there is unbilled amount (using a small threshold for float margin)
            if (unbilledAmount > 10) {
                invoiceBtn += `
                    <button class="btn btn-sm btn-extra-items" style="background-color: #fff7ed; color: #c2410c; border: 1px solid #fdba74; box-shadow: var(--shadow-sm);" onclick="window.location.href='/credit.html'" 
                    data-tippy-content="<strong>⚠️ มีรายการนอกบิล</strong><br>ยอดรวม: ฿${NumberUtils.formatCurrency(unbilledAmount)}<br><span style='font-size:0.9em; opacity:0.9;'>ต้องยกเลิกใบวางบิลเดิมก่อน<br>เพื่อรวมยอดใหม่</span>">
                         ⚠️ รายการนอกบิล
                    </button>
                `;
            }

        } else if (hasUnpaid) {
            // CASE 2: Has Debt but NO Active Invoice -> Show SUCCESS Button (Create Bill)
            invoiceBtn = `
                <button class="btn btn-sm btn-success" style="box-shadow: var(--shadow-sm);" onclick="openInvoice('${customer.id}')" title="สร้างใบวางบิลใหม่">
                     📝 สร้างใบวางบิล
                </button>
            `;
        }
        // CASE 3: History Button is REMOVED as per user request.

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-weight: 500;">${customer.code || '-'}</span></td>
            <td><strong>${customer.name}</strong></td>
            <td>${customer.phone || '-'}</td>
            <td>${customer.contact_person || '-'}</td>
            <td>${unpaidText}</td>
            <td>
                <div class="action-buttons" style="display:flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-sm btn-secondary" onclick="window.editCustomer('${customer.id}')">
                        แก้ไข
                    </button>
                    <button class="btn btn-sm" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;" onclick="window.viewCustomerHistory('${customer.id}')">
                        📜 ประวัติ
                    </button>
                    ${invoiceBtn}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Initialize Tippy
    if (typeof tippy !== 'undefined') {
        tippy('.btn-extra-items', {
            allowHTML: true,
            theme: 'light-border',
            placement: 'top',
            arrow: true,
            animation: 'shift-away'
        });
    }
}

// History Viewer
window.viewCustomerHistory = async function (customerId) {
    try {
        Loading.show();
        // Fetch paid invoices
        const result = await API.get('/api/invoices', { customer_id: customerId, status: 'paid' });
        Loading.hide();

        const invoices = result.invoices || [];
        const customer = window.allCustomers.find(c => c.id == customerId);

        if (invoices.length === 0) {
            Toast.info('ไม่พบประวัติใบวางบิลที่ชำระแล้ว');
            return;
        }

        // Create modal content
        const rows = invoices.map((inv, index) => {
            const issueDate = DateUtils.formatThaiDate(inv.issue_date);
            const paidDate = inv.paid_date ? DateUtils.formatThaiDate(inv.paid_date) : '-';

            return `
                <tr style="cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='white'" onclick="window.showInvoiceDetails('${inv.id}'); document.getElementById('history-modal').remove();">
                    <td style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
                    <td style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #2563eb;">${inv.invoice_number}</td>
                    <td style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0;">${issueDate}</td>
                    <td style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0;">${paidDate}</td>
                    <td style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #059669;">฿${NumberUtils.formatCurrency(inv.total_amount)}</td>
                </tr>
             `;
        }).join('');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'history-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;

        modal.innerHTML = `
            <div style="background: white; width: 90%; max-width: 800px; max-height: 85vh; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
                <div style="padding: 1.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #1e293b;">📜 ประวัติใบวางบิล - ${customer?.name || 'ลูกค้า'}</h3>
                    <button onclick="document.getElementById('history-modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b;">&times;</button>
                </div>
                <div style="overflow-y: auto; padding: 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: #f1f5f9; position: sticky; top: 0;">
                            <tr>
                                <th style="padding: 0.75rem; text-align: center; color: #475569; font-weight: 600;">#</th>
                                <th style="padding: 0.75rem; text-align: left; color: #475569; font-weight: 600;">เลขที่ใบวางบิล</th>
                                <th style="padding: 0.75rem; text-align: left; color: #475569; font-weight: 600;">วันที่ออก</th>
                                <th style="padding: 0.75rem; text-align: left; color: #475569; font-weight: 600;">วันที่ชำระ</th>
                                <th style="padding: 0.75rem; text-align: right; color: #475569; font-weight: 600;">ยอดเงิน</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
                <div style="padding: 1rem; border-top: 1px solid #e2e8f0; text-align: right; background: #f8fafc;">
                    <button class="btn btn-secondary" onclick="document.getElementById('history-modal').remove()">ปิด</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

    } catch (error) {
        Loading.hide();
        console.error('View history error:', error);
        Toast.error('ไม่สามารถเรียกดูประวัติได้');
    }
}

// Search customers
document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = window.allCustomers.filter(c =>
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.phone && c.phone.includes(term)) ||
        (c.code && c.code.toLowerCase().includes(term))
    );
    renderCustomerTable(filtered);
});

// Modal Management (Add Customer)
window.openAddCustomerModal = function () {
    window.isEditing = false;
    window.editingId = null;
    renderModal();
}
// Render Modal for Add/Edit Customer
// Render Modal for Add/Edit Customer
async function renderModal() {
    if (typeof Swal === 'undefined') return;

    const isEdit = window.isEditing;
    const customerId = window.editingId;
    let customerData = { name: '', code: '', phone: '', contact_person: '', tax_id: '', address: '' };

    if (isEdit && customerId) {
        // Find existing data
        const found = window.allCustomers.find(c => c.id == customerId);
        if (found) customerData = { ...found };
    } else {
        // Auto-generate code Kxx for new customer
        const codes = window.allCustomers
            .map(c => c.code)
            .filter(c => c && typeof c === 'string' && c.toUpperCase().startsWith('K'))
            .map(c => parseInt(c.substring(1)))
            .filter(n => !isNaN(n));

        const max = codes.length > 0 ? Math.max(...codes) : 0;
        const next = max + 1;
        customerData.code = 'K' + String(next).padStart(2, '0');
    }

    const { value: formValues } = await Swal.fire({
        title: isEdit ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่',
        html: `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; text-align: left; padding: 0 0.5rem;">
                <!-- Row 1 -->
                <div class="swal-form-group">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">รหัสลูกค้า</label>
                    <input id="swal-code" class="form-control" style="width: 100%; padding: 0.6rem; border: 1px solid #d1d5db; border-radius: 0.5rem; background: #f9fafb;" placeholder="รหัสลูกค้า" value="${customerData.code || ''}" readonly>
                </div>
                <div class="swal-form-group">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">ชื่อลูกค้า / บริษัท <span style="color: #ef4444;">*</span></label>
                    <input id="swal-name" class="form-control" style="width: 100%; padding: 0.6rem; border: 1px solid #d1d5db; border-radius: 0.5rem;" placeholder="ระบุชื่อลูกค้า" value="${customerData.name || ''}">
                </div>

                <!-- Row 2 -->
                <div class="swal-form-group">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">เบอร์โทรศัพท์</label>
                    <input id="swal-phone" class="form-control" style="width: 100%; padding: 0.6rem; border: 1px solid #d1d5db; border-radius: 0.5rem;" placeholder="เบอร์โทรศัพท์" value="${customerData.phone || ''}">
                </div>
                <div class="swal-form-group">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">ผู้ติดต่อ</label>
                    <input id="swal-contact" class="form-control" style="width: 100%; padding: 0.6rem; border: 1px solid #d1d5db; border-radius: 0.5rem;" placeholder="ชื่อผู้ติดต่อ" value="${customerData.contact_person || ''}">
                </div>
            </div>
        `,
        width: '700px',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        customClass: {
            container: 'swal-modal-container',
            popup: 'swal-popup-custom',
            header: 'swal-header-custom',
            title: 'swal-title-custom',
            content: 'swal-content-custom',
            confirmButton: 'btn btn-primary',
            cancelButton: 'btn btn-secondary'
        },
        preConfirm: () => {
            const name = document.getElementById('swal-name').value;
            if (!name) {
                Swal.showValidationMessage('กรุณาระบุชื่อลูกค้า');
                return false;
            }
            return {
                code: document.getElementById('swal-code').value,
                name: name,
                phone: document.getElementById('swal-phone').value,
                contact_person: document.getElementById('swal-contact').value,
                tax_id: '',
                address: ''
            };
        }
    });

    if (formValues) {
        saveCustomer(formValues);
    }
}

// Window function for edit
window.editCustomer = function (id) {
    window.isEditing = true;
    window.editingId = id;
    renderModal();
}

async function saveCustomer(data) {
    try {
        Loading.show();
        if (window.isEditing) {
            await API.put(`/api/customer/${window.editingId}`, data);
            Toast.success('แก้ไขข้อมูลลูกค้าสำเร็จ');
        } else {
            await API.post('/api/customer', data);
            Toast.success('เพิ่มลูกค้าใหม่สำเร็จ');
        }
        loadCustomers();
    } catch (error) {
        console.error('Save customer error:', error);
        Toast.error('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
        Loading.hide();
    }
}
// ... (Lines 151-188) ...
// Invoice Management
// Added optional directInvoiceId to speed up opening if we know it
window.openInvoice = async function (customerId, directInvoiceId) {
    try {
        // If we know the active invoice ID (passed from Green Button), skip the list check
        if (directInvoiceId && directInvoiceId !== 'undefined') {
            showInvoiceDetails(directInvoiceId);
            return;
        }

        Loading.show();
        const result = await API.get('/api/invoices', { customer_id: customerId });
        Loading.hide();

        const invoices = result.invoices || [];

        // Check for Active or Pending invoice
        const activeOrPending = invoices.find(inv => inv.status === 'active' || inv.status === 'pending');

        if (!activeOrPending) {
            // "No active invoices" popup for "Create Bill" scenario
            const title = 'ไม่พบใบวางบิลที่ค้างชำระ';
            const text = `
                <div style="text-align: left; line-height: 1.6;">
                    <p style="margin-bottom: 1rem; color: #4b5563;">ลูกค้ารายนี้ไม่มีใบวางบิลที่ค้างชำระในขณะนี้</p>
                    <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0;">
                        <strong style="color: #0ea5e9;">วิธีสร้างใบวางบิลใหม่:</strong>
                        <ol style="margin: 0.5rem 0 0 1.2rem; padding: 0; color: #64748b;">
                            <li>ไปที่เมนู <strong>"เงินเชื่อ"</strong></li>
                            <li>กดปุ่ม <strong>"ค้นหา"</strong> เพื่อดูรายการบิลทั้งหมด</li>
                            <li>เลือกบิลที่ต้องการ (เฉพาะสถานะ Unpaired)</li>
                            <li>กดปุ่ม <strong>"สร้างใบวางบิล"</strong></li>
                        </ol>
                    </div>
                </div>`;

            Modal.confirm(
                title,
                text,
                () => { window.location.href = '/credit.html'; },
                'ไปหน้าจัดการเงินเชื่อ',
                'ปิด'
            );
            return;
        }

        showInvoiceDetails(activeOrPending.id);

    } catch (error) {
        Loading.hide();
        console.error('Check invoice error:', error);
        Toast.error('เกิดข้อผิดพลาดในการตรวจสอบใบวางบิล');
    }
}
// ...
// Show invoice details modal
window.showInvoiceDetails = async function (invoiceId) {
    try {
        Loading.show();

        // Get invoice details with bills
        const result = await API.get(`/api/invoices/${invoiceId}`);
        const invoice = result.invoice;

        Loading.hide();

        if (!invoice) {
            Toast.error('ไม่พบข้อมูลใบวางบิล');
            return;
        }

        const customer = invoice.customers;
        const bills = invoice.bills || [];

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'invoice-detail-modal';
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
            overflow-y: auto;
        `;

        const billsHtml = bills.map((bill, index) => `
            <tr>
                <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
                <td style="padding: 0.5rem; border: 1px solid #ddd;">${DateUtils.formatThaiDate(bill.date)}</td>
                <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${bill.bill_book}-${bill.bill_number}</td>
                <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${bill.vehicle_number || '-'}</td>
                <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: right;"><strong>฿${NumberUtils.formatCurrency(bill.amount)}</strong></td>
            </tr>
        `).join('');

        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 1rem; max-width: 900px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                    <div>
                        <h2 style="margin: 0; color: #2D3E50;">ใบวางบิล ${invoice.invoice_number}</h2>
                        <p style="margin: 0.5rem 0 0; color: #666;">วันที่ออกใบวางบิล: ${DateUtils.formatThaiDate(invoice.issue_date)}</p>
                    </div>
                    <span class="badge" style="background: #f59e0b; color: white; padding: 0.5rem 1rem; font-size: 1rem;">สถานะ: ${invoice.status === 'paid' ? 'ชำระแล้ว' : 'ค้างชำระ'}</span>
                </div>

                <div style="background: #f8f9fa; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div>
                            <div style="color: #666; font-size: 0.9rem;">ลูกค้า</div>
                            <div style="font-weight: bold; font-size: 1.1rem; color: #333;">${customer?.name || 'ไม่ทราบ'}</div>
                        </div>
                        <div>
                            <div style="color: #666; font-size: 0.9rem;">จำนวนบิล</div>
                            <div style="font-weight: bold; font-size: 1.1rem; color: #333;">${bills.length} รายการ</div>
                        </div>
                        <div>
                            <div style="color: #666; font-size: 0.9rem;">ยอดรวม</div>
                            <div style="font-weight: bold; font-size: 1.3rem; color: #f59e0b;">฿${NumberUtils.formatCurrency(invoice.total_amount)}</div>
                        </div>
                    </div>
                </div>

                <h3 style="margin: 1.5rem 0 1rem; color: #2D3E50;">รายการบิล</h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #e3e3e3;">
                                <th style="padding: 0.75rem; border: 1px solid #ddd; text-align: center;">#</th>
                                <th style="padding: 0.75rem; border: 1px solid #ddd;">วันที่</th>
                                <th style="padding: 0.75rem; border: 1px solid #ddd; text-align: center;">เล่มที่-เลขที่</th>
                                <th style="padding: 0.75rem; border: 1px solid #ddd; text-align: center;">ทะเบียนรถ</th>
                                <th style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">ยอดเงิน</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${billsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f8f9fa; font-weight: bold;">
                                <td colspan="4" style="padding: 0.75rem; border: 1px solid #ddd; text-align: right;">รวมทั้งสิ้น</td>
                                <td style="padding: 0.75rem; border: 1px solid #ddd; text-align: right; font-size: 1.1rem; color: #2D3E50;">฿${NumberUtils.formatCurrency(invoice.total_amount)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div style="display: flex; gap: 0.5rem; margin-top: 2rem; justify-content: flex-end; flex-wrap: wrap;">
                    <button class="btn btn-secondary" onclick="window.closeInvoiceDetailModal()">ปิด</button>
                    ${invoice.status === 'paid' ? `
                         <!-- Print button for paid -->
                        <button class="btn btn-primary" onclick="window.printInvoicePDF('${invoice.id}')">🖨️ พิมพ์ใบวางบิล</button>
                        <button class="btn" style="background-color: #f97316; color: white; border: none;" onclick="window.revertInvoicePayment('${invoice.id}')">↩️ ยกเลิกการชำระเงิน</button>
                    ` : `
                        <button class="btn btn-primary" onclick="window.printInvoicePDF('${invoice.id}')">🖨️ พิมพ์ใบวางบิล</button>
                        <button class="btn btn-warning" onclick="window.cancelInvoiceFromCustomer('${invoice.id}')">ยกเลิกใบวางบิล</button>
                        <button class="btn btn-success" onclick="window.payInvoiceFromCustomer('${invoice.id}')">ชำระเงิน</button>
                    `}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) window.closeInvoiceDetailModal();
        };

    } catch (error) {
        Loading.hide();
        console.error('Show invoice details error:', error);
        Toast.error('เกิดข้อผิดพลาดในการแสดงรายละเอียดใบวางบิล');
    }
}

window.closeInvoiceDetailModal = function () {
    const modal = document.getElementById('invoice-detail-modal');
    if (modal) modal.remove();
}

/* DELETE FUNCTION DISABLED BY USER REQUEST
window.deleteCustomer = function(id) {
    // Styling the title for visibility (White for Dark Modal)
    const titleHtml = '<span style="color: #fff; font-weight: bold;">ลบข้อมูลลูกค้า</span>';
    const textHtml = '<div style="color: #e2e8f0;">คุณแน่ใจหรือไม่ที่จะลบลูกค้าท่านนี้? <br><span style="color: #fca5a5; font-size: 0.9em;">การกระทำนี้ไม่สามารถเรียกคืนได้</span></div>';
    
    Modal.confirm(
        titleHtml,
        textHtml,
        async () => {
            Loading.show();
            try {
                await API.delete(`/api/customer/${id}`);
                Toast.success('ลบข้อมูลลูกค้าเรียบร้อยแล้ว');
                loadCustomers(); // Reload the customer list
            } catch (error) {
                console.error('Error deleting customer:', error);
                Toast.error('ไม่สามารถลบข้อมูลลูกค้าได้');
            } finally {
                Loading.hide();
            }
        }
    );
}
*/

window.cancelInvoiceFromCustomer = async function (invoiceId) {
    const title = 'ยืนยันการยกเลิกใบวางบิล';
    const text = 'ต้องการยกเลิกใบวางบิลนี้หรือไม่?<br><br><small style="color: #ef4444;">• บิลทั้งหมดจะกลับไปเป็นสถานะ "ยังไม่ได้วางบิล"<br>• เลขที่ใบวางบิลนี้จะถูกลบและนำกลับมาใช้ใหม่</small>';

    Modal.confirm(
        title,
        text,
        async () => {
            try {
                Loading.show();
                await API.post(`/api/invoices/${invoiceId}/cancel`, {});

                Loading.hide();
                Toast.success('ยกเลิกใบวางบิลเรียบร้อยแล้ว');

                window.closeInvoiceDetailModal();
                loadCustomers(); // Reload customer list

            } catch (error) {
                Loading.hide();
                console.error('Cancel invoice error:', error);
                Toast.error('ไม่สามารถยกเลิกใบวางบิลได้');
            }
        },
        'ยืนยันการยกเลิก',
        'ปิด'
    );
}

window.payInvoiceFromCustomer = async function (invoiceId) {
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

            return {
                paymentMethod: selectedMethod.value,
                paymentDate: paymentDate
            };
        },
        customClass: {
            popup: 'swal-popup-custom',
            title: 'swal-title-custom',
            content: 'swal-text-custom'
        }
    });

    if (formValues) {
        try {
            Loading.show();
            await API.post(`/api/invoices/${invoiceId}/pay`, {
                payment_method: formValues.paymentMethod,
                payment_date: formValues.paymentDate
            });

            Toast.success('บันทึกการชำระเงินเรียบร้อยแล้ว');
            window.closeInvoiceDetailModal();
            loadCustomers(); // Reload to update status
        } catch (error) {
            console.error('Payment error:', error);
            Toast.error(error.message || 'ไม่สามารถบันทึกการชำระเงินได้');
        } finally {
            Loading.hide();
        }
    }
}

window.revertInvoicePayment = async function (invoiceId) {
    const title = 'ยกเลิกการชำระเงิน';
    const text = 'ต้องการยกเลิกการชำระเงินและย้อนกลับสถานะใบวางบิลหรือไม่?<br><br><small style="color: #64748b;">• รายการบัญชีที่เกี่ยวข้องจะถูกลบออก<br>• สถานะใบวางบิลจะกลับเป็นรอชำระ</small>';

    Modal.confirm(
        title,
        text,
        async () => {
            try {
                Loading.show();

                const result = await API.post(`/api/invoices/${invoiceId}/revert-payment`);

                Loading.hide();
                Toast.success(result.message || 'ยกเลิกการชำระเงินสำเร็จ');

                // Reload invoice details
                loadInvoiceDetails(invoiceId);

            } catch (error) {
                Loading.hide();
                console.error('Revert payment error:', error);
                Toast.error('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถยกเลิกการชำระเงินได้'));
            }
        }
    );
}

// Print Invoice PDF (Assuming printInvoicePDF same logic but making it global)
window.printInvoicePDF = async function (invoiceId) {
    // ... Copy of the extensive print logic or reuse if utils has it ...
    // For brevity, I will assume the original logic is good but needs to ensure `formatThaiDateFull` availability.
    // If DateUtils covers it excellent. If not, I'll use DateUtils.formatThaiDate.

    // Check if formatThaiDateFull exists, if not polyfill it locally
    const formatThaiDateFull = (d) => DateUtils.getThaiDate(d);
    const formatThaiDateNumeric = (d) => DateUtils.formatDate(d, 'DD/MM/YYYY');

    try {
        Loading.show();

        const result = await API.get(`/api/invoices/${invoiceId}`);
        const invoice = result.invoice;
        const customer = invoice.customers;
        const bills = invoice.bills || [];

        Loading.hide();

        if (!bills || bills.length === 0) {
            Toast.warning('ไม่พบรายการบิลในใบวางบิล');
            return;
        }

        bills.sort((a, b) => new Date(a.date) - new Date(b.date));

        const ITEMS_PER_PAGE = 20;
        const totalPages = Math.ceil(bills.length / ITEMS_PER_PAGE);
        const now = new Date(invoice.issue_date);
        const invoiceNo = invoice.invoice_number;

        let dateRangeText = "";
        if (bills.length > 0) {
            const startDate = new Date(bills[0].date);
            const endDate = new Date(bills[bills.length - 1].date);
            dateRangeText = `วันที่ ${formatThaiDateFull(startDate)} ถึง  วันที่ ${formatThaiDateFull(endDate)}`;
        }

        const container = document.createElement('div');
        let grandTotal = parseFloat(invoice.total_amount);

        for (let page = 0; page < totalPages; page++) {
            const startIdx = page * ITEMS_PER_PAGE;
            const endIdx = startIdx + ITEMS_PER_PAGE;
            const pageItems = bills.slice(startIdx, endIdx);

            const pageDiv = document.createElement('div');
            pageDiv.className = 'invoice-page';

            let rowsHtml = '';
            pageItems.forEach((item, i) => {
                const globalIndex = startIdx + i + 1;
                const dateStr = formatThaiDateNumeric(new Date(item.date));
                rowsHtml += `
                    <tr>
                        <td style="padding: 4px 6px; text-align: center; border: 1px solid #ddd; height: 28px;">${globalIndex}</td>
                        <td style="padding: 4px 6px; text-align: center; border: 1px solid #ddd;">${dateStr}</td>
                        <td style="padding: 4px 6px; text-align: center; border: 1px solid #ddd;">${item.bill_book || '-'}</td>
                        <td style="padding: 4px 6px; text-align: center; border: 1px solid #ddd;">${item.bill_number || '-'}</td>
                        <td style="padding: 4px 6px; text-align: center; border: 1px solid #ddd;">${item.vehicle_number || '-'}</td>
                        <td style="padding: 4px 6px; text-align: right; border: 1px solid #ddd;">${NumberUtils.formatCurrency(item.amount)}</td>
                    </tr>
                `;
            });

            let footerHtml = '';
            if (page === totalPages - 1) {
                footerHtml = `
                    <tfoot>
                        <tr style="font-weight: bold; background: #eee;">
                            <td colspan="5" style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 1rem;">รวมเป็นเงินทั้งสิ้น</td>
                            <td style="padding: 8px; text-align: right; border: 1px solid #ddd; font-size: 1.1rem; color: #2D3E50;">฿${NumberUtils.formatCurrency(grandTotal)}</td>
                        </tr>
                    </tfoot>
                `;
            }

            const headerHtml = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="width: 50px; height: 50px; background: #00A8E8; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border-radius: 50%; font-size: 1.2rem;">BC</div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.2rem; color: #2D3E50;">บีซี ปิโตรเลียม</h2>
                            <p style="margin: 0; font-size: 0.8rem; color: #666;">40 ม.6 ต.เตาปูน อ.แก่งคอย จ.สระบุรี 18110</p>
                            <p style="margin: 0; font-size: 0.8rem; color: #666;">โทร: 096-236-9153</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <h1 style="margin: 0; color: #2D3E50; font-size: 1.8rem;">ใบวางบิล</h1>
                        <p style="margin: 0.2rem 0 0; font-size: 0.9rem;">เลขที่: <b>${invoiceNo}</b></p>
                        <p style="margin: 0; font-size: 0.9rem;">วันที่: ${formatThaiDateFull(now)}</p>
                        <p style="margin: 0; font-size: 0.8rem; color: #999;">หน้า ${page + 1}/${totalPages}</p>
                    </div>
                </div>
                <hr style="border: none; border-top: 2px solid #eee; margin: 0 0 0.8rem;">

                <div style="margin-bottom: 0.8rem; background: #f8f9fa; padding: 0.6rem; border-radius: 0.5rem; display: flex; align-items: baseline; gap: 10px;">
                    <span style="color: #666; font-size: 1rem;">ลูกค้า:</span>
                    <span style="font-weight: bold; font-size: 1.3rem; color: #2D3E50;">${customer.name}</span>
                </div>

                <div style="text-align: center; margin-bottom: 0.6rem; font-weight: bold; color: #444; font-size: 0.9rem;">
                    ${dateRangeText}
                </div>
            `;

            const pageBreakStyle = (page < totalPages - 1) ? 'page-break-after: always;' : '';

            pageDiv.innerHTML = `
                <div style="padding: 10mm 15mm; height: 100%; position: relative; ${pageBreakStyle}">
                    ${headerHtml}
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background: #e3e3e3ff; color: white;">
                                <th style="padding: 6px; text-align: center; width: 40px; border: 1px solid #ddd;">#</th>
                                <th style="padding: 6px; text-align: center; width: 120px; border: 1px solid #ddd;">วันที่</th>
                                <th style="padding: 6px; text-align: center; width: 90px; border: 1px solid #ddd;">บิลเล่มที่</th>
                                <th style="padding: 6px; text-align: center; width: 90px; border: 1px solid #ddd;">บิลเลขที่</th>
                                <th style="padding: 6px; text-align: center; width: 90px; border: 1px solid #ddd;">ทะเบียนรถ</th>
                                <th style="padding: 6px; text-align: right; border: 1px solid #ddd;">จำนวนเงิน</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                        ${footerHtml}
                    </table>
                </div>
            `;

            container.appendChild(pageDiv);
        }

        const content = container.innerHTML;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();

        const pdfFilename = `${customer.name}-${invoiceNo}`;

        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${pdfFilename}</title>
                <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;700&display=swap" rel="stylesheet">
                <style>
                    body, html { margin: 0; padding: 0; background: white; width: 100%; height: 100%; }
                    body { font-family: 'Sarabun', sans-serif; -webkit-print-color-adjust: exact; }
                    .invoice-page { width: 210mm; height: 296mm; margin: 0 auto; padding: 5mm 10mm; box-sizing: border-box; position: relative; page-break-after: always; overflow: hidden; }
                    .invoice-page:last-child { page-break-after: auto !important; height: auto !important; min-height: auto !important; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 6px; }
                    thead th { background-color: #e9e9e9ff !important; color: #000000 !important; font-weight: bold; border: 1px solid #ddd !important; -webkit-print-color-adjust: exact; }
                    @media print { @page { size: A4; margin: 0; } body { margin: 0; } }
                </style>
            </head>
            <body>
                ${content}
            </body>
            </html>
        `);
        doc.close();

        iframe.contentWindow.focus();
        setTimeout(() => {
            iframe.contentWindow.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 1000);
        }, 500);

    } catch (error) {
        Loading.hide();
        console.error('Print PDF error:', error);
        Toast.error('เกิดข้อผิดพลาดในการพิมพ์ใบวางบิล');
    }
}

// Initialize
Auth.requireAuth();
updateDate();
loadUserInfo();
loadCustomers();

// Logout
document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    Modal.confirm('ออกจากระบบ', 'คุณต้องการออกจากระบบใช่หรือไม่?', () => Auth.logout());
});
