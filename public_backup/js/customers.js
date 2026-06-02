// Customers Management JavaScript
Auth.requireAuth();

// Global variables
let allCustomers = [];
let isEditing = false;
let editingId = null;
let currentCustomerName = '';
let currentInvoiceNo = '';

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
        const result = await API.get('/api/customer');
        allCustomers = result.data || [];
        renderCustomerTable(allCustomers);
    } catch (error) {
        console.error('Error loading customers:', error);
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
            ? `<span style="color: #FF6B6B; font-weight: bold;">฿${NumberUtils.formatCurrency(customer.unpaidAmount)}</span>`
            : '<span style="color: #28a745; opacity: 0.8;">ไม่มียอดค้าง</span>';

        // Check unpaid
        const hasUnpaid = customer.unpaidAmount > 0;
        const currentUser = Auth.getCurrentUser();
        const isAdmin = currentUser && currentUser.role === 'admin';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge" style="background: #E3F2FD; color: #1565C0; border: 1px solid #90CAF9; font-weight: 500;">${customer.code || '-'}</span></td>
            <td><strong>${customer.name}</strong></td>
            <td>${customer.phone || '-'}</td>
            <td>${customer.contact_person || '-'}</td>
            <td>${unpaidText}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-outline-primary" onclick="editCustomer('${customer.id}')">
                        แก้ไข
                    </button>
                    ${isAdmin ? `
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteCustomer('${customer.id}')">
                        ลบ
                    </button>
                    ` : ''}
                    ${(hasUnpaid || isAdmin) ? `
                    <button class="btn btn-sm btn-primary" onclick="openInvoice('${customer.id}')" title="ใบวางบิล / ประวัติ">
                        📄 ใบวางบิล
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Search customers
document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allCustomers.filter(c =>
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.phone && c.phone.includes(term)) ||
        (c.code && c.code.toLowerCase().includes(term))
    );
    renderCustomerTable(filtered);
});

// Modal Management
function openAddCustomerModal() {
    isEditing = false;
    editingId = null;

    // Create modal HTML
    const modalHtml = `
        <div class="modal-overlay" id="customerModal">
            <div class="modal-dialog">
                <h3 style="margin-bottom: 1.5rem;">${isEditing ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}</h3>
                <form id="customerForm">
                    <div class="form-group">
                        <label class="form-label">รหัสลูกค้า</label>
                        <input type="text" class="form-control" name="code" placeholder="เช่น C001" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">ชื่อลูกค้า / บริษัท</label>
                        <input type="text" class="form-control" name="name" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">เบอร์โทรศัพท์</label>
                        <input type="tel" class="form-control" name="phone">
                    </div>
                    <div class="form-group">
                        <label class="form-label">ผู้ติดต่อ</label>
                        <textarea class="form-control" name="contact_person" rows="2" placeholder="ชื่อพนักงานผู้ติดต่อ"></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">หมายเหตุ</label>
                        <textarea class="form-control" name="note" rows="2"></textarea>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()" style="flex: 1;">ยกเลิก</button>
                        <button type="submit" class="btn btn-primary" style="flex: 1;">บันทึก</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHtml;

    // Form Submit Handler
    document.getElementById('customerForm').addEventListener('submit', handleFormSubmit);
}

function closeModal() {
    document.getElementById('modalContainer').innerHTML = '';
}

// Edit Customer
async function editCustomer(id) {
    const customer = allCustomers.find(c => c.id == id); // Loose equality for string/number id
    if (!customer) return;

    isEditing = true;
    editingId = id;

    // Use same modal but populate data
    openAddCustomerModal(); // This resets isEditing, so verify logic

    // Fix logic: openAddCustomerModal resets variables, so we set them AFTER
    isEditing = true;
    editingId = id;

    // Update Modal Title
    document.querySelector('#customerModal h3').textContent = 'แก้ไขข้อมูลลูกค้า';

    // Populate form
    const form = document.getElementById('customerForm');
    form.elements['code'].value = customer.code || '';
    form.elements['name'].value = customer.name || '';
    form.elements['phone'].value = customer.phone || '';
    form.elements['contact_person'].value = customer.contact_person || '';
    form.elements['note'].value = customer.note || '';
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = {
        code: form.elements['code'].value,
        name: form.elements['name'].value,
        phone: form.elements['phone'].value,
        contact_person: form.elements['contact_person'].value,
        note: form.elements['note'].value
    };

    try {
        Loading.show();
        let result;

        if (isEditing) {
            result = await API.put(`/api/customer/${editingId}`, formData);
            Toast.success('แก้ไขข้อมูลสำเร็จ');
        } else {
            result = await API.post('/api/customer', formData);
            Toast.success('เพิ่มลูกค้าสำเร็จ');
        }

        closeModal();
        loadCustomers(); // Reload list
        Loading.hide();
    } catch (error) {
        Loading.hide();
        console.error('Save customer error:', error);
        Toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// Delete Customer
async function deleteCustomer(id) {
    Modal.confirm(
        'ลบข้อมูลลูกค้า',
        'คุณแน่ใจหรือไม่ที่จะลบลูกค้าท่านนี้? การกระทำนี้ไม่สามารถเรียกคืนได้',
        async () => {
            try {
                Loading.show();
                await API.delete(`/api/customer/${id}`);
                Toast.success('ลบข้อมูลสำเร็จ');
                loadCustomers();
                Loading.hide();
            } catch (error) {
                Loading.hide();
                console.error('Delete error:', error);

                // Check if error is about existing credit sales
                if (error.error && error.error.includes('existing credit sales')) {
                    Toast.error('ไม่สามารถลบได้เนื่องจากมีประวัติการซื้อเชื่อ');
                } else {
                    Toast.error('เกิดข้อผิดพลาดในการลบข้อมูล');
                }
            }
        }
    );
}

// Invoice Management - Display existing invoice only
async function openInvoice(customerId) {
    try {
        Loading.show();

        // Check if customer has any invoices (Active or Paid)
        const result = await API.get('/api/invoices', { 
            customer_id: customerId
        });

        Loading.hide();

        const invoices = result.invoices || [];

        if (invoices.length === 0) {
            Modal.confirm(
                'ไม่พบใบวางบิล',
                `ลูกค้ารายนี้ยังไม่มีใบวางบิลที่ค้างชำระ<br><br>
                <strong>วิธีสร้างใบวางบิล:</strong><br>
                1. ไปที่เมนู "จัดการเงินเชื่อ"<br>
                2. กดปุ่ม "ค้นหา" เพื่อดูรายการบิลทั้งหมด<br>
                3. เลือกบิลที่ต้องการวางบิล (เฉพาะบิลที่ยังไม่ได้วางบิล)<br>
                4. กดปุ่ม "สร้างใบวางบิล"`,
                () => {
                    // Redirect to credit sales page
                    window.location.href = '/credit.html';
                },
                'ไปหน้าจัดการเงินเชื่อ',
                'ปิด'
            );
            return;
        }

        // Logic:
        // 1. If there is an ACTIVE invoice, show it first (Priority).
        // 2. If no active invoice, show the LATEST invoice (e.g. the one just paid).
        const activeInvoice = invoices.find(inv => inv.status === 'active');
        const targetInvoice = activeInvoice || invoices[0];
        
        showInvoiceDetails(targetInvoice.id);

    } catch (error) {
        Loading.hide();
        console.error('Check invoice error:', error);
        Toast.error('เกิดข้อผิดพลาดในการตรวจสอบใบวางบิล');
    }
}

// Show invoice details modal
async function showInvoiceDetails(invoiceId) {
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
                    <span class="badge" style="background: #f59e0b; color: white; padding: 0.5rem 1rem; font-size: 1rem;">สถานะ: ค้างชำระ</span>
                </div>

                <div style="background: #f8f9fa; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div>
                            <div style="color: #666; font-size: 0.9rem;">ลูกค้า</div>
                            <div style="font-weight: bold; font-size: 1.1rem;">${customer?.name || 'ไม่ทราบ'}</div>
                        </div>
                        <div>
                            <div style="color: #666; font-size: 0.9rem;">จำนวนบิล</div>
                            <div style="font-weight: bold; font-size: 1.1rem;">${bills.length} รายการ</div>
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
                    <button class="btn btn-secondary" onclick="closeInvoiceDetailModal()">ปิด</button>
                    <button class="btn btn-primary" onclick="printInvoicePDF(${invoice.id})">🖨️ พิมพ์ใบวางบิล</button>
                    ${invoice.status === 'paid' ? `
                        <button class="btn" style="background-color: #f97316; color: white; border: none;" onclick="revertInvoicePayment(${invoice.id})">↩️ ยกเลิกการชำระเงิน</button>
                    ` : `
                        <button class="btn btn-warning" onclick="cancelInvoiceFromCustomer(${invoice.id})">ยกเลิกใบวางบิล</button>
                        <button class="btn btn-success" onclick="payInvoiceFromCustomer(${invoice.id})">ชำระเงิน</button>
                    `}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) closeInvoiceDetailModal();
        };

    } catch (error) {
        Loading.hide();
        console.error('Show invoice details error:', error);
        Toast.error('เกิดข้อผิดพลาดในการแสดงรายละเอียดใบวางบิล');
    }
}

function closeInvoiceDetailModal() {
    const modal = document.getElementById('invoice-detail-modal');
    if (modal) modal.remove();
}

async function cancelInvoiceFromCustomer(invoiceId) {
    Modal.confirm(
        'ยืนยันการยกเลิกใบวางบิล',
        'ต้องการยกเลิกใบวางบิลนี้หรือไม่?<br>บิลทั้งหมดจะกลับไปเป็นสถานะ "ยังไม่ได้วางบิล"',
        async () => {
            try {
                Loading.show();
                const result = await API.post(`/api/invoices/${invoiceId}/cancel`);
                Loading.hide();
                Toast.success(result.message || 'ยกเลิกใบวางบิลสำเร็จ');
                closeInvoiceDetailModal();
                loadCustomers(); // Reload customer list
            } catch (error) {
                Loading.hide();
                console.error('Cancel invoice error:', error);
                Toast.error(error.message || 'ไม่สามารถยกเลิกใบวางบิลได้');
            }
        }
    );
}

async function payInvoiceFromCustomer(invoiceId) {
    const { value: paymentMethod } = await Swal.fire({
        title: 'ระบุช่องทางการชำระเงิน',
        input: 'radio',
        inputOptions: {
            'cash': 'เงินสด 💵',
            'transfer': 'เงินโอน 📲'
        },
        inputValue: 'cash',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        inputValidator: (value) => {
            if (!value) {
                return 'กรุณาเลือกช่องทางการชำระเงิน'
            }
        }
    });

    if (paymentMethod) {
        try {
            Loading.show();
            const result = await API.post(`/api/invoices/${invoiceId}/pay`, {
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: paymentMethod
            });
            Loading.hide();
            
            Swal.fire({
                icon: 'success',
                title: 'บันทึกสำเร็จ',
                text: 'รายการถูกส่งไปยังหน้า "จัดการเงินสด" เพื่อรอยืนยันแล้วครับ',
                confirmButtonText: 'ตกลง'
            });

            closeInvoiceDetailModal();
            loadCustomers(); // Reload customer list
        } catch (error) {
            Loading.hide();
            console.error('Pay invoice error:', error);
            Toast.error(error.message || 'ไม่สามารถบันทึกการชำระเงินได้');
        }
    }
}

async function revertInvoicePayment(invoiceId) {
    Modal.confirm(
        'ยกเลิกการชำระเงิน',
        'ต้องการยกเลิกการชำระเงินและย้อนกลับสถานะใบวางบิลหรือไม่?<br>รายการบัญชีที่เกี่ยวข้องจะถูกลบออก',
        async () => {
            try {
                Loading.show();
                const result = await API.post(`/api/invoices/${invoiceId}/revert-payment`);
                Loading.hide();
                Toast.success(result.message || 'ยกเลิกการชำระเงินสำเร็จ');
                closeInvoiceDetailModal();
                loadCustomers(); // Reload customer list
            } catch (error) {
                Loading.hide();
                console.error('Revert payment error:', error);
                Toast.error(error.message || 'ไม่สามารถยกเลิกการชำระเงินได้');
            }
        }
    );
}

// Print Invoice PDF
async function printInvoicePDF(invoiceId) {
    try {
        Loading.show();
        
        // Get invoice details with bills
        const result = await API.get(`/api/invoices/${invoiceId}`);
        const invoice = result.invoice;
        const customer = invoice.customers;
        const bills = invoice.bills || [];
        
        Loading.hide();

        if (!bills || bills.length === 0) {
            Toast.warning('ไม่พบรายการบิลในใบวางบิล');
            return;
        }

        // Sort bills by date
        bills.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate pages
        const ITEMS_PER_PAGE = 20;
        const totalPages = Math.ceil(bills.length / ITEMS_PER_PAGE);
        const now = new Date(invoice.issue_date);
        const invoiceNo = invoice.invoice_number;

        // Date Range
        let dateRangeText = "";
        if (bills.length > 0) {
            const startDate = new Date(bills[0].date);
            const endDate = new Date(bills[bills.length - 1].date);
            dateRangeText = `วันที่ ${formatThaiDateFull(startDate)} ถึง  วันที่ ${formatThaiDateFull(endDate)}`;
        }

        // Generate HTML for EACH page
        const container = document.createElement('div');
        let grandTotal = parseFloat(invoice.total_amount);

        for (let page = 0; page < totalPages; page++) {
            const startIdx = page * ITEMS_PER_PAGE;
            const endIdx = startIdx + ITEMS_PER_PAGE;
            const pageItems = bills.slice(startIdx, endIdx);

            const pageDiv = document.createElement('div');
            pageDiv.className = 'invoice-page';

            // Generate Rows HTML
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

            // Total Row (Only on LAST page)
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

            // Header (Repeat on every page)
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

        // Create and print using iframe (same as original code)
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
                    
                    .invoice-page {
                        width: 210mm;
                        height: 296mm;
                        margin: 0 auto; 
                        padding: 5mm 10mm;
                        box-sizing: border-box;
                        position: relative;
                        page-break-after: always;
                        overflow: hidden;
                    }

                    .invoice-page:last-child {
                        page-break-after: auto !important;
                        height: auto !important;
                        min-height: auto !important;
                    }

                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 6px; }
                    thead th { 
                        background-color: #e9e9e9ff !important; 
                        color: #000000 !important; 
                        font-weight: bold;
                        border: 1px solid #ddd !important;
                        -webkit-print-color-adjust: exact; 
                    }
                    
                    @media print {
                        @page { size: A4; margin: 0; }
                        body { margin: 0; }
                    }
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

// ---------------------------------------------------------
// FINAL ROBUST PRINT SOLUTION: IFRAME ISOLATION
// ---------------------------------------------------------
window.printInvoice = function () {
    const content = document.getElementById('printContainer').innerHTML;

    // 1. Create a hidden IFrame
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    // 2. Write content into IFrame
    const doc = iframe.contentWindow.document;
    doc.open();
    
    // Set document title for PDF filename
    const pdfFilename = currentCustomerName && currentInvoiceNo 
        ? `${currentCustomerName}-${currentInvoiceNo}`
        : 'Invoice';
    
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${pdfFilename}</title>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;700&display=swap" rel="stylesheet">
            <style>
                /* RESET & BASE */
                body, html { margin: 0; padding: 0; background: white; width: 100%; height: 100%; }
                body { font-family: 'Sarabun', sans-serif; -webkit-print-color-adjust: exact; }
                
                /* PAGE STRUCTURE */
                .invoice-page {
                    width: 210mm;
                    height: 296mm; /* Fixed Height for A4 consistency */
                    margin: 0 auto; 
                    padding: 5mm 10mm; /* Reduced Padding: More content, less white space */
                    box-sizing: border-box;
                    position: relative;
                    page-break-after: always;
                    overflow: hidden; /* Strict overflow control */
                }

                /* LAST PAGE HANDLING: No break, flexible height */
                .invoice-page:last-child {
                    page-break-after: auto !important;
                    height: auto !important;
                    min-height: auto !important;
                }

                /* TABLE STYLES */
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 6px; }
                thead th { 
                    background-color: #e9e9e9ff !important; 
                    color: #000000 !important; 
                    font-weight: bold;
                    border: 1px solid #ddd !important;
                    -webkit-print-color-adjust: exact; 
                }
                
                /* UTILS */
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                
                /* PRINT SETUP */
                @media print {
                    @page { size: A4; margin: 0; }
                    body { margin: 0; }
                }
            </style>
        </head>
        <body>
            ${content}
        </body>
        </html>
    `);
    doc.close();

    // 3. Wait for content to load (fonts/images) then Print
    iframe.contentWindow.focus();
    setTimeout(() => {
        iframe.contentWindow.print();

        // 4. Cleanup after print dialog usage (delay to ensure print dialog opened)
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    }, 500);
};

function formatThaiDateFull(date) {
    const months = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function formatThaiDateNumeric(date) {
    // dd/mm/yyyy (Thai Year)
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear() + 543;
    return `${d}/${m}/${y}`;
}

// Helper to get fuel name
function getName(type) {
    const names = {
        'e91': 'แก๊สโซฮอล์ 91',
        'e95': 'แก๊สโซฮอล์ 95',
        'b7': 'ดีเซล B7'
    };
    return names[type] || type;
}

function closeInvoiceModal() {
    document.getElementById('invoiceModal').style.display = 'none';
}

function printInvoice() {
    window.print();
}

// Expose functions to window
window.openAddCustomerModal = openAddCustomerModal;
window.closeModal = closeModal;
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.openInvoice = openInvoice;
window.closeInvoiceModal = closeInvoiceModal;
window.printInvoice = printInvoice;

// Initialize
updateDate();
loadUserInfo();
loadCustomers();
