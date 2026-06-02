// Reports V2 JavaScript
Auth.requireAuth();

// Global State
let state = {
    currentTab: 'sales',
    chartInstance: null,
    data: null,
    summary: null
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    Auth.setupTopBar();
    loadUserInfo();
    setupDatePickers();
    loadCustomers(); // Pre-load customers

    // Check hash for initial tab
    const hash = window.location.hash.replace('#', '');
    if (['sales', 'fuel', 'credit', 'invoice'].includes(hash)) {
        switchReport(hash);
    } else {
        switchReport('sales'); // Default
    }
});

function setupDatePickers() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    // Using correct Date format for input[type=date]
    document.getElementById('startDate').value = DateUtils.formatDate(firstDay, 'YYYY-MM-DD');
    document.getElementById('endDate').value = DateUtils.formatDate(today, 'YYYY-MM-DD');
}

function loadUserInfo() {
    const user = Auth.getCurrentUser();
    if (user) {
        document.getElementById('userName').textContent = user.name || user.username;
        document.getElementById('userRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน';
        document.getElementById('userAvatar').textContent = user.name ? user.name[0].toUpperCase() : 'U';
    }
}

async function loadCustomers() {
    try {
        const result = await API.get('/api/customer');
        if (result && result.data) {
            const select = document.getElementById('customerSelect');
            if (select) {
                // Keep first option "All"
                const allOption = select.options[0];
                select.innerHTML = '';
                select.appendChild(allOption);

                result.data.forEach(customer => {
                    const opt = document.createElement('option');
                    opt.value = customer.id;
                    opt.textContent = `${customer.code} - ${customer.name}`;
                    select.appendChild(opt);
                });
            }
        }
    } catch (error) {
        console.error('Failed to load customers:', error);
    }
}

// Tab Switching Logic
window.switchReport = function (tabName) {
    state.currentTab = tabName;

    // Update Tab UI
    document.querySelectorAll('.report-tab').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update Filters Visibility
    const fuelFilter = document.getElementById('fuelFilter');
    const customerFilter = document.getElementById('customerFilter');
    const statusFilter = document.getElementById('statusFilter');
    const invoiceStatusFilter = document.getElementById('invoiceStatusFilter');

    // Default: Hide all specific filters
    if (fuelFilter) fuelFilter.style.display = 'none';
    if (customerFilter) customerFilter.style.display = 'none';
    if (statusFilter) statusFilter.style.display = 'none';
    if (invoiceStatusFilter) invoiceStatusFilter.style.display = 'none';

    if (tabName === 'sales') {
        // Only date range (always visible)
    } else if (tabName === 'fuel') {
        if (fuelFilter) fuelFilter.style.display = 'flex';
    } else if (tabName === 'credit') {
        if (customerFilter) customerFilter.style.display = 'flex';
        if (statusFilter) statusFilter.style.display = 'flex';
    } else if (tabName === 'invoice') {
        if (customerFilter) customerFilter.style.display = 'flex';
        if (invoiceStatusFilter) invoiceStatusFilter.style.display = 'flex';
    }

    // Load Data Automatically when switching
    loadReportData();
}

// Main Data Loader
window.loadReportData = async function () {
    Loading.show();
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        let url = '';
        let params = { startDate, endDate };
        let creditParams = { startDate, endDate }; // For background fetching of credit info

        if (state.currentTab === 'sales') {
            url = '/api/report/profit-loss';
        } else if (state.currentTab === 'fuel') {
            url = '/api/report/sales';
            const fuelType = document.getElementById('fuelTypeSelect').value;
            if (fuelType !== 'all') params.fuelType = fuelType;
        } else if (state.currentTab === 'credit') {
            url = '/api/report/credit';
            const status = document.getElementById('creditStatusSelect').value;
            const customerId = document.getElementById('customerSelect').value;

            if (status === 'paid') params.paid = 'true';
            if (status === 'unpaid') params.paid = 'false';

            if (customerId !== 'all') params.customerId = customerId;
        } else if (state.currentTab === 'invoice') {
            // Invoice tab uses a different API
            url = '/api/invoices';
            const invoiceStatus = document.getElementById('invoiceStatusSelect').value;
            const customerId = document.getElementById('customerSelect').value;

            if (invoiceStatus !== 'all') params.status = invoiceStatus;
            if (customerId !== 'all') params.customer_id = customerId;
        }

        // Fetch Main Data
        const result = await API.get(url, params);

        if (result) {
            // Invoice tab has different response structure
            if (state.currentTab === 'invoice') {
                let invoices = result.invoices || [];

                // Filter by date range
                invoices = invoices.filter(inv => {
                    const issueDate = inv.issue_date || inv.created_at?.split('T')[0];
                    return issueDate >= startDate && issueDate <= endDate;
                });

                state.data = invoices;

                // Calculate summary
                const totalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
                const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
                const activeAmount = invoices.filter(inv => inv.status === 'active').reduce((sum, inv) => sum + parseFloat(inv.remaining_amount || 0), 0);

                state.summary = {
                    totalInvoices: invoices.length,
                    totalAmount,
                    paidAmount,
                    activeAmount,
                    paidCount: invoices.filter(inv => inv.status === 'paid').length,
                    activeCount: invoices.filter(inv => inv.status === 'active').length
                };

                updateDashboardSummary(state.summary);
                renderChart(state.data);
                renderTable(state.data);
            } else {
                state.data = result.data;
                state.summary = result.summary;

                // If we are in Sales or Fuel tab, the API doesn't return Unpaid Credit info.
                if (state.currentTab === 'sales' || state.currentTab === 'fuel') {
                    try {
                        const creditResult = await API.get('/api/report/credit', creditParams);
                        if (creditResult && creditResult.summary) {
                            state.summary.unpaidAmount = creditResult.summary.unpaidAmount;
                        }
                    } catch (err) {
                        console.warn('Failed to fetch background credit info', err);
                    }
                }

                updateDashboardSummary(state.summary);
                renderChart(result.data);
                renderTable(result.data);
            }

            Toast.success('โหลดข้อมูลเรียบร้อย');
        }
    } catch (error) {
        console.error('Error loading report:', error);
        Toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
        Loading.hide();
    }
}

// UI Updaters
// Update Dashboard Summary
function updateDashboardSummary(summary) {
    if (!summary) return;

    if (state.currentTab === 'sales' || state.currentTab === 'fuel') {
        document.getElementById('summaryTotalSales').textContent = '฿' + NumberUtils.formatNumber(summary.totalSales || 0, 0);

        const profit = summary.totalProfit !== undefined ? summary.totalProfit : 0;
        document.getElementById('summaryTotalProfit').textContent = '฿' + NumberUtils.formatNumber(profit, 0);
        document.getElementById('summaryTotalProfit').nextElementSibling.innerHTML = 'กำไรสุทธิ';
        document.getElementById('summaryTotalProfit').parentElement.previousElementSibling.style.background = 'rgba(16, 185, 129, 0.1)';

        document.getElementById('summaryTotalLiters').textContent = NumberUtils.formatNumber(summary.totalLiters || 0);
        document.getElementById('summaryTotalLiters').parentElement.previousElementSibling.style.background = 'rgba(245, 158, 11, 0.1)';
        document.getElementById('summaryTotalLiters').nextElementSibling.innerHTML = 'ปริมาณขาย (ลิตร)';

        const unpaid = summary.unpaidAmount || summary.unpaidCredit || 0;
        document.getElementById('summaryUnpaidCredit').textContent = '฿' + NumberUtils.formatNumber(unpaid, 0);
        document.getElementById('summaryUnpaidCredit').parentElement.parentElement.style.opacity = '1';
        document.getElementById('summaryUnpaidCredit').nextElementSibling.innerHTML = 'ยอดค้างชำระ';

    } else if (state.currentTab === 'credit') {
        document.getElementById('summaryTotalSales').textContent = '฿' + NumberUtils.formatNumber(summary.totalAmount || 0, 0);
        document.getElementById('summaryTotalSales').nextElementSibling.innerHTML = 'ยอดขายเชื่อรวม';

        document.getElementById('summaryTotalProfit').textContent = '฿' + NumberUtils.formatNumber(summary.paidAmount || 0, 0);
        document.getElementById('summaryTotalProfit').nextElementSibling.innerHTML = 'ชำระแล้ว';

        document.getElementById('summaryTotalLiters').textContent = summary.totalBills || 0;
        document.getElementById('summaryTotalLiters').nextElementSibling.innerHTML = 'จำนวนบิล';
        document.getElementById('summaryTotalLiters').parentElement.previousElementSibling.style.background = 'rgba(59, 130, 246, 0.1)';

        document.getElementById('summaryUnpaidCredit').textContent = '฿' + NumberUtils.formatNumber(summary.unpaidAmount || 0, 0);
        document.getElementById('summaryUnpaidCredit').parentElement.parentElement.style.opacity = '1';
    } else if (state.currentTab === 'invoice') {
        document.getElementById('summaryTotalSales').textContent = summary.totalInvoices || 0;
        document.getElementById('summaryTotalSales').nextElementSibling.innerHTML = 'จำนวน INV ทั้งหมด';

        document.getElementById('summaryTotalProfit').textContent = '฿' + NumberUtils.formatNumber(summary.totalAmount || 0, 0);
        document.getElementById('summaryTotalProfit').nextElementSibling.innerHTML = 'ยอดรวมทั้งหมด';
        document.getElementById('summaryTotalProfit').parentElement.previousElementSibling.style.background = 'rgba(59, 130, 246, 0.1)';

        document.getElementById('summaryTotalLiters').textContent = '฿' + NumberUtils.formatNumber(summary.paidAmount || 0, 0);
        document.getElementById('summaryTotalLiters').nextElementSibling.innerHTML = 'ชำระแล้ว';
        document.getElementById('summaryTotalLiters').parentElement.previousElementSibling.style.background = 'rgba(16, 185, 129, 0.1)';

        document.getElementById('summaryUnpaidCredit').textContent = '฿' + NumberUtils.formatNumber(summary.activeAmount || 0, 0);
        document.getElementById('summaryUnpaidCredit').nextElementSibling.innerHTML = 'ค้างชำระ';
        document.getElementById('summaryUnpaidCredit').parentElement.parentElement.style.opacity = '1';
    }
}

// Chart Render Tooltip
function renderChart(data) {
    const ctx = document.getElementById('mainChart').getContext('2d');

    // Destroy previous chart
    if (state.chartInstance) {
        state.chartInstance.destroy();
    }

    // Default Configuration
    let config = {
        type: 'line',
        data: {},
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                if (state.currentTab === 'fuel' && context.dataset.yAxisID !== 'y-sales') { // Volume
                                    label += NumberUtils.formatNumber(context.parsed.y) + ' ลิตร';
                                } else {
                                    label += '฿' + NumberUtils.formatNumber(context.parsed.y, 0);
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    };

    // Chart Needs data in ascending order to plot left-to-right correctly
    // The previous [...data].reverse() logic was buggy because if the API already returns mixed or ascending data, it acts randomly.
    // Instead we will sort the array strictly by Date ascending.
    const sortedData = [...data].sort((a, b) => {
        const dateA = new Date(a.date || a.issue_date || 0);
        const dateB = new Date(b.date || b.issue_date || 0);
        return dateA - dateB;
    });

    const dates = sortedData.map(d => {
        const date = new Date(d.date || d.issue_date);
        const dayName = date.toLocaleDateString('th-TH', { weekday: 'short' }); // จ., อ., ...
        const dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }); // 1 ม.ค.
        return [dateStr, dayName];
    });

    if (state.currentTab === 'sales') {
        config.data = {
            labels: dates,
            datasets: [
                {
                    label: 'ยอดขาย',
                    data: sortedData.map(d => d.total_sales || d.sales),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    yAxisID: 'y',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'กำไร',
                    data: sortedData.map(d => d.total_profit || d.profit),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    yAxisID: 'y',
                    fill: true,
                    tension: 0.4
                }
            ]
        };
    } else if (state.currentTab === 'fuel') {
        config.type = 'bar';
        const fuelType = document.getElementById('fuelTypeSelect') ? document.getElementById('fuelTypeSelect').value : 'all';

        let datasets = [];

        const colors = {
            e91: '#ef4444', // Red
            e95: '#10b981', // Green
            b7: '#3b82f6'   // Blue
        };

        if (fuelType === 'all') {
            datasets.push({
                label: 'แก๊สโซฮอล์ 91',
                data: sortedData.map(d => d.e91_liters || 0),
                backgroundColor: colors.e91,
            });
            datasets.push({
                label: 'แก๊สโซฮอล์ 95',
                data: sortedData.map(d => d.e95_liters || 0),
                backgroundColor: colors.e95,
            });
            datasets.push({
                label: 'ดีเซล B7',
                data: sortedData.map(d => d.b7_liters || 0),
                backgroundColor: colors.b7,
            });
        } else if (fuelType === 'e91') {
            datasets.push({
                label: 'แก๊สโซฮอล์ 91',
                data: sortedData.map(d => d.liters || 0),
                backgroundColor: colors.e91,
            });
        } else if (fuelType === 'e95') {
            datasets.push({
                label: 'แก๊สโซฮอล์ 95',
                data: sortedData.map(d => d.liters || 0),
                backgroundColor: colors.e95,
            });
        } else if (fuelType === 'b7') {
            datasets.push({
                label: 'ดีเซล B7',
                data: sortedData.map(d => d.liters || 0),
                backgroundColor: colors.b7,
            });
        }

        config.data = {
            labels: dates,
            datasets: datasets
        };
        config.options.scales = {
            x: { stacked: true },
            y: { stacked: true }
        };
    } else if (state.currentTab === 'credit') {
        config.data = {
            labels: dates,
            datasets: [
                {
                    label: 'ยอดเงินเชื่อ',
                    data: sortedData.map(d => d.amount),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        };
    } else if (state.currentTab === 'invoice') {
        // For invoices, group by customer and show bar chart
        config.type = 'bar';

        // Group invoices by customer
        const customerMap = {};
        data.forEach(inv => {
            const customerName = inv.customers?.name || 'ไม่ระบุ';
            if (!customerMap[customerName]) {
                customerMap[customerName] = { paid: 0, active: 0 };
            }
            if (inv.status === 'paid') {
                customerMap[customerName].paid += parseFloat(inv.total_amount || 0);
            } else {
                customerMap[customerName].active += parseFloat(inv.remaining_amount || 0);
            }
        });

        const customerNames = Object.keys(customerMap);

        config.data = {
            labels: customerNames.map(name => name.length > 15 ? name.substring(0, 15) + '...' : name),
            datasets: [
                {
                    label: 'ค้างชำระ',
                    data: customerNames.map(name => customerMap[name].active),
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    borderColor: '#f59e0b',
                    borderWidth: 1
                },
                {
                    label: 'ชำระแล้ว',
                    data: customerNames.map(name => customerMap[name].paid),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: '#10b981',
                    borderWidth: 1
                }
            ]
        };
        config.options.scales = {
            x: { stacked: true },
            y: {
                stacked: true,
                ticks: {
                    callback: function (value) {
                        return '฿' + NumberUtils.formatNumber(value, 0);
                    }
                }
            }
        };
    }

    state.chartInstance = new Chart(ctx, config);
}

// Render Table
function renderTable(data) {
    const thead = document.getElementById('tableHeader');
    const tbody = document.getElementById('tableBody');
    const tfoot = document.getElementById('tableFooter');

    // Update Print Header Date Range
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const printDoc = document.getElementById('printDateRange');
    if (printDoc) {
        if (startDate && endDate) {
            printDoc.textContent = `ช่วงเวลา: ${DateUtils.formatThaiDate(startDate)} ถึง ${DateUtils.formatThaiDate(endDate)}`;
        } else {
            printDoc.textContent = 'ข้อมูลทั้งหมด';
        }
    }

    tbody.innerHTML = '';
    thead.innerHTML = '';
    tfoot.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" class="text-center p-4">ไม่พบข้อมูล</td></tr>`;
        return;
    }

    // Sort data from oldest to newest for table
    const tableData = [...data].sort((a, b) => {
        const dateA = new Date(a.date || a.issue_date || 0);
        const dateB = new Date(b.date || b.issue_date || 0);
        return dateA - dateB;
    });

    if (state.currentTab === 'sales') {
        thead.innerHTML = `
            <tr>
                <th>วันที่</th>
                <th class="text-end">ยอดขาย (บาท)</th>
                <th class="text-end">กำไร (บาท)</th>
                <th class="text-end">ปริมาณ (ลิตร)</th>
                <th class="text-end">กำไร/ลิตร (เฉลี่ย)</th>
            </tr>
        `;

        let sumSales = 0, sumProfit = 0, sumLiters = 0;

        tableData.forEach(row => {
            const sales = parseFloat(row.total_sales || row.sales || 0);
            const profit = parseFloat(row.total_profit || row.profit || 0);
            const liters = parseFloat(row.total_liters || row.liters || 0);
            const margin = liters > 0 ? profit / liters : 0;

            sumSales += sales;
            sumProfit += profit;
            sumLiters += liters;

            tbody.innerHTML += `
                <tr>
                    <td>${DateUtils.formatThaiDate(row.date)}</td>
                    <td class="text-end">฿${NumberUtils.formatNumber(sales, 0)}</td>
                    <td class="text-end text-success">฿${NumberUtils.formatNumber(profit, 0)}</td>
                    <td class="text-end">${NumberUtils.formatNumber(liters)}</td>
                    <td class="text-end">฿${margin.toFixed(2)}</td>
                </tr>
            `;
        });

        tfoot.innerHTML = `
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
                <td>รวมทั้งสิ้น</td>
                <td class="text-end">฿${NumberUtils.formatNumber(sumSales, 0)}</td>
                <td class="text-end text-success">฿${NumberUtils.formatNumber(sumProfit, 0)}</td>
                <td class="text-end">${NumberUtils.formatNumber(sumLiters)}</td>
                <td></td>
            </tr>
        `;

    } else if (state.currentTab === 'fuel') {
        thead.innerHTML = `
            <tr>
                <th>วันที่</th>
                <th class="text-end">E91 (ลิตร)</th>
                <th class="text-end">E95 (ลิตร)</th>
                <th class="text-end">B7 (ลิตร)</th>
                <th class="text-end">รวม (ลิตร)</th>
            </tr>
        `;

        let sumE91 = 0, sumE95 = 0, sumB7 = 0, sumTotal = 0;

        tableData.forEach(row => {
            let e91 = 0, e95 = 0, b7 = 0;

            // Handle different data structures based on filter
            if (row.fuelType === 'E91') e91 = parseFloat(row.liters || 0);
            else if (row.fuelType === 'E95') e95 = parseFloat(row.liters || 0);
            else if (row.fuelType === 'B7') b7 = parseFloat(row.liters || 0);
            else {
                e91 = parseFloat(row.e91_liters || 0);
                e95 = parseFloat(row.e95_liters || 0);
                b7 = parseFloat(row.b7_liters || 0);
            }

            const total = parseFloat(row.total_liters || (e91 + e95 + b7));

            sumE91 += e91;
            sumE95 += e95;
            sumB7 += b7;
            sumTotal += total;

            tbody.innerHTML += `
                <tr>
                    <td>${DateUtils.formatThaiDate(row.date)}</td>
                    <td class="text-end">${NumberUtils.formatNumber(e91)}</td>
                    <td class="text-end">${NumberUtils.formatNumber(e95)}</td>
                    <td class="text-end">${NumberUtils.formatNumber(b7)}</td>
                    <td class="text-end fw-bold">${NumberUtils.formatNumber(total)}</td>
                </tr>
            `;
        });

        tfoot.innerHTML = `
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
                <td>รวมทั้งสิ้น</td>
                <td class="text-end">${NumberUtils.formatNumber(sumE91)}</td>
                <td class="text-end">${NumberUtils.formatNumber(sumE95)}</td>
                <td class="text-end">${NumberUtils.formatNumber(sumB7)}</td>
                <td class="text-end">${NumberUtils.formatNumber(sumTotal)}</td>
            </tr>
        `;
    } else if (state.currentTab === 'credit') {
        thead.innerHTML = `
            <tr>
                <th>วันที่</th>
                <th>ลูกค้า</th>
                <th class="text-end">จำนวนเงิน</th>
                <th class="text-center">สถานะ</th>
                <th>หมายเหตุ</th>
            </tr>
        `;

        let sumAmount = 0;

        tableData.forEach(row => {
            const amount = parseFloat(row.amount || 0);
            sumAmount += amount;

            const statusBadge = row.paid
                ? '<span class="badge badge-success">จ่ายแล้ว</span>'
                : '<span class="badge badge-danger">ยังไม่จ่าย</span>';

            tbody.innerHTML += `
                <tr>
                    <td>${DateUtils.formatThaiDate(row.date)}</td>
                    <td>${row.customers?.name || '-'}</td>
                    <td class="text-end">฿${NumberUtils.formatNumber(amount, 0)}</td>
                    <td class="text-center">${statusBadge}</td>
                    <td>${row.note || '-'}</td>
                </tr>
            `;
        });

        tfoot.innerHTML = `
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
                <td colspan="2">รวมทั้งสิ้น</td>
                <td class="text-end">฿${NumberUtils.formatNumber(sumAmount, 0)}</td>
                <td colspan="2"></td>
            </tr>
        `;
    } else if (state.currentTab === 'invoice') {
        thead.innerHTML = `
            <tr>
                <th>เลข INV</th>
                <th>ลูกค้า</th>
                <th>วันที่ออก</th>
                <th class="text-end">ยอดรวม</th>
                <th class="text-end">ค้างชำระ</th>
                <th class="text-center">สถานะ</th>
                <th>วิธีชำระ</th>
                <th>วันที่ชำระ</th>
            </tr>
        `;

        let sumTotal = 0, sumRemaining = 0;

        tableData.forEach(inv => {
            const total = parseFloat(inv.total_amount || 0);
            const remaining = parseFloat(inv.remaining_amount || 0);
            sumTotal += total;
            sumRemaining += inv.status === 'active' ? remaining : 0;

            let statusBadge = '';
            if (inv.status === 'paid') {
                statusBadge = '<span class="badge badge-success">🟢 ชำระแล้ว</span>';
            } else if (inv.status === 'active') {
                statusBadge = '<span class="badge badge-warning" style="background: #FEF3C7; color: #92400E;">🟡 ค้างชำระ</span>';
            } else {
                statusBadge = '<span class="badge badge-secondary">' + inv.status + '</span>';
            }

            let paymentMethodLabel = '-';
            if (inv.payment_method === 'cash') paymentMethodLabel = '💵 เงินสด';
            else if (inv.payment_method === 'transfer') paymentMethodLabel = '🏦 โอนเงิน';

            tbody.innerHTML += `
                <tr onclick="showInvoiceDetail(${inv.id}, '${inv.invoice_number}')" style="cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
                    <td style="font-weight: 600; color: var(--primary);">${inv.invoice_number} <span style="font-size: 0.75rem; color: var(--text-tertiary);">🔍</span></td>
                    <td>${inv.customers?.name || '-'}</td>
                    <td>${DateUtils.formatThaiDate(inv.issue_date)}</td>
                    <td class="text-end">฿${NumberUtils.formatNumber(total, 0)}</td>
                    <td class="text-end" style="color: ${remaining > 0 ? '#EF4444' : '#10B981'};">
                        ฿${NumberUtils.formatNumber(remaining, 0)}
                    </td>
                    <td class="text-center">${statusBadge}</td>
                    <td>${paymentMethodLabel}</td>
                    <td>${inv.paid_date ? DateUtils.formatThaiDate(inv.paid_date) : '-'}</td>
                </tr>
            `;
        });

        tfoot.innerHTML = `
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
                <td colspan="3">รวมทั้งสิ้น (${data.length} ใบ)</td>
                <td class="text-end">฿${NumberUtils.formatNumber(sumTotal, 0)}</td>
                <td class="text-end" style="color: #EF4444;">฿${NumberUtils.formatNumber(sumRemaining, 0)}</td>
                <td colspan="3"></td>
            </tr>
        `;
    }
}

// Show Invoice Detail Modal
window.showInvoiceDetail = async function (invoiceId, invoiceNumber) {
    try {
        Swal.fire({
            title: `🧾 ${invoiceNumber}`,
            html: '<div style="text-align: center; padding: 2rem;"><div class="spinner" style="width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto;"></div><p style="margin-top: 1rem; color: #6b7280;">กำลังโหลดข้อมูล...</p></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>',
            showConfirmButton: false,
            showCloseButton: true,
            width: '700px',
        });

        const result = await API.get(`/api/invoices/${invoiceId}`);
        if (!result || !result.invoice) {
            Swal.fire('ผิดพลาด', 'ไม่พบข้อมูลใบวางบิล', 'error');
            return;
        }

        const inv = result.invoice;
        const bills = inv.bills || [];
        const customerName = inv.customers?.name || '-';

        let statusLabel = '';
        if (inv.status === 'paid') {
            statusLabel = '<span style="background: #D1FAE5; color: #065F46; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600;">🟢 ชำระแล้ว</span>';
        } else {
            statusLabel = '<span style="background: #FEF3C7; color: #92400E; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600;">🟡 ค้างชำระ</span>';
        }

        let billRows = '';
        let billTotal = 0;
        bills.forEach((bill, idx) => {
            const amount = parseFloat(bill.amount || 0);
            billTotal += amount;

            billRows += `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 0.6rem 0.5rem; color: #6b7280; font-size: 0.85rem;">${idx + 1}</td>
                    <td style="padding: 0.6rem 0.5rem; font-size: 0.85rem;">${DateUtils.formatDate(bill.date)}</td>
                    <td style="padding: 0.6rem 0.5rem; font-size: 0.85rem; text-align: center;">${bill.bill_book || '-'}</td>
                    <td style="padding: 0.6rem 0.5rem; font-size: 0.85rem; text-align: center;">${bill.bill_number || '-'}</td>
                    <td style="padding: 0.6rem 0.5rem; text-align: right; font-weight: 600; font-size: 0.85rem;">฿${NumberUtils.formatNumber(amount, 2)}</td>
                    <td style="padding: 0.6rem 0.5rem; font-size: 0.85rem; text-align: center;">${bill.vehicle_number || '-'}</td>
                </tr>
            `;
        });

        const html = `
            <div style="text-align: left;">
                <!-- Invoice Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 2px solid #e5e7eb;">
                    <div>
                        <div style="font-size: 0.85rem; color: #6b7280;">ลูกค้า</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: #1e293b;">👤 ${customerName}</div>
                    </div>
                    <div style="text-align: right;">
                        <div>${statusLabel}</div>
                        <div style="font-size: 0.8rem; color: #9ca3af; margin-top: 0.25rem;">ออกเมื่อ ${DateUtils.formatDate(inv.issue_date)}</div>
                    </div>
                </div>

                <!-- Summary -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                    <div style="background: #EFF6FF; padding: 0.75rem; border-radius: 0.5rem; text-align: center;">
                        <div style="font-size: 1.1rem; font-weight: 700; color: #1d4ed8;">฿${NumberUtils.formatNumber(inv.total_amount, 0)}</div>
                        <div style="font-size: 0.75rem; color: #6b7280;">ยอดรวม</div>
                    </div>
                    <div style="background: #D1FAE5; padding: 0.75rem; border-radius: 0.5rem; text-align: center;">
                        <div style="font-size: 1.1rem; font-weight: 700; color: #065F46;">฿${NumberUtils.formatNumber(inv.paid_amount || 0, 0)}</div>
                        <div style="font-size: 0.75rem; color: #6b7280;">ชำระแล้ว</div>
                    </div>
                    <div style="background: ${inv.remaining_amount > 0 ? '#FEF3C7' : '#D1FAE5'}; padding: 0.75rem; border-radius: 0.5rem; text-align: center;">
                        <div style="font-size: 1.1rem; font-weight: 700; color: ${inv.remaining_amount > 0 ? '#92400E' : '#065F46'};">฿${NumberUtils.formatNumber(inv.remaining_amount || 0, 0)}</div>
                        <div style="font-size: 0.75rem; color: #6b7280;">ค้างชำระ</div>
                    </div>
                </div>

                ${inv.paid_date ? `<div style="margin-bottom: 1rem; padding: 0.5rem 0.75rem; background: #F0FDF4; border-radius: 0.5rem; font-size: 0.85rem; color: #166534;">
                    💳 ชำระเมื่อ: ${DateUtils.formatDate(inv.paid_date)} | วิธี: ${inv.payment_method === 'transfer' ? '🏦 โอนเงิน' : '💵 เงินสด'} 
                    <span style="font-weight: 500; margin-left: 0.5rem; padding-left: 0.5rem; border-left: 1px solid #bbf7d0;">✓ ยืนยันโดย: ${inv.confirmed_by || 'ระบบ'}</span>
                </div>` : ''}

                <!-- Bills Table -->
                <div style="font-weight: 600; margin-bottom: 0.5rem; color: #374151;">📋 รายการบิลที่รวมอยู่ (${bills.length} บิล)</div>
                <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #e5e7eb; position: sticky; top: 0;">
                                <th style="padding: 0.5rem; text-align: left; font-size: 0.75rem; color: #6b7280; font-weight: 600;">#</th>
                                <th style="padding: 0.5rem; text-align: left; font-size: 0.75rem; color: #6b7280; font-weight: 600;">วันที่</th>
                                <th style="padding: 0.5rem; text-align: center; font-size: 0.75rem; color: #6b7280; font-weight: 600;">เล่มที่</th>
                                <th style="padding: 0.5rem; text-align: center; font-size: 0.75rem; color: #6b7280; font-weight: 600;">เลขที่</th>
                                <th style="padding: 0.5rem; text-align: right; font-size: 0.75rem; color: #6b7280; font-weight: 600;">จำนวนเงิน</th>
                                <th style="padding: 0.5rem; text-align: center; font-size: 0.75rem; color: #6b7280; font-weight: 600;">ทะเบียนรถ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${billRows || '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #9ca3af;">ไม่มีรายการบิล</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f1f5f9; font-weight: 700; border-top: 2px solid #e5e7eb;">
                                <td colspan="4" style="padding: 0.6rem 0.5rem; font-size: 0.85rem;">รวมทั้งสิ้น (${bills.length} บิล)</td>
                                <td style="padding: 0.6rem 0.5rem; text-align: right; font-size: 0.85rem;">฿${NumberUtils.formatNumber(billTotal, 2)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                ${inv.note ? `<div style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: #f8fafc; border-radius: 0.5rem; font-size: 0.85rem; color: #6b7280;">📝 หมายเหตุ: ${inv.note}</div>` : ''}
            </div>
        `;

        Swal.fire({
            title: `🧾 ${invoiceNumber}`,
            html: html,
            showCloseButton: true,
            confirmButtonText: 'ปิด',
            confirmButtonColor: '#3b82f6',
            width: '700px',
        });

    } catch (error) {
        console.error('Error loading invoice detail:', error);
        Swal.fire('ผิดพลาด', 'ไม่สามารถโหลดข้อมูลใบวางบิลได้', 'error');
    }
}
