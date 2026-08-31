(function() {
    function applyTheme() {
        const theme = 'dark-red';
        document.documentElement.setAttribute('data-theme', theme);
        if (document.body) {
            document.body.setAttribute('data-theme', theme);
            document.body.style.backgroundColor = '#120708';
            document.body.style.color = '#ffffff';
        }
        localStorage.setItem('rto_dashboard_theme', theme);

        if (window.trendChart) updateChartInstance(window.trendChart);
        if (window.subrtoChart) updateChartInstance(window.subrtoChart);
        if (window.chartInstance) updateChartInstance(window.chartInstance);
    }

    function updateChartInstance(chart) {
        if (!chart || !chart.options) return;
        const tickColor = '#c9a5a9';
        const gridColor = 'rgba(255, 255, 255, 0.08)';

        if (chart.options.scales) {
            if (chart.options.scales.x && chart.options.scales.x.ticks) {
                chart.options.scales.x.ticks.color = tickColor;
            }
            if (chart.options.scales.y) {
                if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = tickColor;
                if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = gridColor;
            }
        }
        if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
            chart.options.plugins.legend.labels.color = '#ffffff';
        }
        chart.update();
    }

    document.documentElement.setAttribute('data-theme', 'dark-red');

    window.changeTheme = function() { applyTheme(); };
    window.initTheme = function() { applyTheme(); };
    window.updateChartTheme = function() {
        if (window.trendChart) updateChartInstance(window.trendChart);
        if (window.subrtoChart) updateChartInstance(window.subrtoChart);
        if (window.chartInstance) updateChartInstance(window.chartInstance);
    };

    document.addEventListener('DOMContentLoaded', function() {
        applyTheme();
    });
})();

