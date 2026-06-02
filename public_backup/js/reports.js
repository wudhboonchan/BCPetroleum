// Reports JavaScript
Auth.requireAuth();

// Global Chart Instance
let salesTrendsChart = null;

// Load user info
function loadUserInfo() {
    const user = Auth.getCurrentUser();
    if (user) {
        document.getElementById('userName').textContent = user.name || user.username;
        document.getElementById('userRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน';
        document.getElementById('userAvatar').textContent = user.name ? user.name[0].toUpperCase() : 'U';
    }
}

// Update date display
function updateDateDisplay() {
    document.getElementById('currentDate').textContent = DateUtils.getThaiDate();
}

// Set default date range (Current Month)
function setDefaultDateRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    document.getElementById('startDate').value = formatDate(firstDay);
    document.getElementById('endDate').value = formatDate(lastDay);

    // Auto load
    generateReport();
}

// Generate Report
async function generateReport() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
        Toast.error('กรุณาเลือกช่วงวันที่');
        return;
    }

    try {
        Loading.show();

        // Fetch Profit/Loss Report
        const result = await API.get('/api/report/profit-loss', { startDate, endDate });

        if (result && result.data) {
            updateSummary(result.summary);
            updateTable(result.data);
            updateChart(result.data);
            Toast.success('โหลดข้อมูลเรียบร้อยแล้ว');
        } else {
            Toast.warning('ไม่พบข้อมูลในช่วงเวลาที่เลือก');
            clearDisplay();
        }

        Loading.hide();
    } catch (error) {
        Loading.hide();
        console.error('Report error:', error);
        Toast.error('เกิดข้อผิดพลาดในการโหลดรายงาน');
    }
}

function clearDisplay() {
    document.getElementById('summarySales').textContent = '฿0.00';
    document.getElementById('summaryProfit').textContent = '฿0.00';
    document.getElementById('summaryLiters').textContent = '0';
    document.getElementById('reportTableBody').innerHTML = '';

    if (salesTrendsChart) {
        salesTrendsChart.data.datasets.forEach((dataset) => {
            dataset.data = [];
        });
        salesTrendsChart.update();
    }
}

// Update Summary Cards
function updateSummary(summary) {
    document.getElementById('summarySales').textContent = '฿' + NumberUtils.formatCurrency(summary.totalSales);
    document.getElementById('summaryProfit').textContent = '฿' + NumberUtils.formatCurrency(summary.totalProfit);
    document.getElementById('summaryLiters').textContent = NumberUtils.formatLiters(summary.totalLiters);
}

// Update Table
function updateTable(data) {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">ไม่พบข้อมูล</td></tr>`;
        return;
    }

    // Data comes sorted by date descending from API
    data.forEach(record => {
        const tr = document.createElement('tr');
        const date = new Date(record.date);

        tr.innerHTML = `
            <td>${DateUtils.formatDate(date)}</td>
            <td>${NumberUtils.formatNumber(record.e91_liters)}</td>
            <td>${NumberUtils.formatNumber(record.e95_liters)}</td>
            <td>${NumberUtils.formatNumber(record.b7_liters)}</td>
            <td><strong>${NumberUtils.formatNumber(record.total_liters)}</strong></td>
            <td>฿${NumberUtils.formatCurrency(record.total_sales)}</td>
            <td style="color: #4ECDC4;">฿${NumberUtils.formatCurrency(record.total_profit)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Update Chart
function updateChart(data) {
    const ctx = document.getElementById('salesTrendsChart');

    // Prepare data (reverse to show chronological order left-to-right)
    const chartData = [...data].reverse();

    const labels = chartData.map(d => {
        const date = new Date(d.date);
        return `${date.getDate()}/${date.getMonth() + 1}`;
    });

    const salesData = chartData.map(d => d.total_sales);
    const profitData = chartData.map(d => d.total_profit);

    if (salesTrendsChart) {
        salesTrendsChart.data.labels = labels;
        salesTrendsChart.data.datasets[0].data = salesData;
        salesTrendsChart.data.datasets[1].data = profitData;
        salesTrendsChart.update();
    } else {
        salesTrendsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'ยอดขาย (บาท)',
                        data: salesData,
                        borderColor: '#00A8E8',
                        backgroundColor: 'rgba(0, 168, 232, 0.1)',
                        borderWidth: 3,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'กำไร (บาท)',
                        data: profitData,
                        borderColor: '#4ECDC4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        borderWidth: 3,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                return context.dataset.label + ': ฿' + NumberUtils.formatCurrency(context.parsed.y);
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            font: { family: 'Chakra Petch' }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return '฿' + NumberUtils.formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
    }
}

// Event Listeners
document.getElementById('filterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    generateReport();
});

// Initialize
loadUserInfo();
updateDateDisplay();
setDefaultDateRange(); // This will also load initial data
