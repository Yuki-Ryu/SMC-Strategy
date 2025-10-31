// This Pine Script™ code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// GitHub https://github.com/Yuki-Ryu/SMC-Strategy#

//@version=5
strategy("SMC Multi-Timeframe Strategy", shorttitle="SMC Strategy", overlay=true, initial_capital=1000, default_qty_type=strategy.percent_of_equity, default_qty_value=10, pyramiding=0, calc_on_every_tick=false, max_bars_back=500)

// Input parameters
mtf_trend = input.string("1D", "Trend Timeframe", options=["1D", "4H"])
entry_tf = input.string("1H", "Entry Timeframe", options=["1H", "15min"])
use_500_bars = input.bool(true, "Use Last 500 Bars Only", tooltip="Optimize performance by limiting historical analysis")

// Limit bars for backtesting efficiency
var int max_bars = 500
if use_500_bars and bar_index > max_bars
    strategy.cancel_all()
    strategy.close_all()

// Get higher timeframe data
htf_close = request.security(syminfo.tickerid, mtf_trend, close, barmerge.gaps_on)
htf_high = request.security(syminfo.tickerid, mtf_trend, high, barmerge.gaps_on) 
htf_low = request.security(syminfo.tickerid, mtf_trend, low, barmerge.gaps_on)

// Market Structure Detection
is_hh = high > high[1] and low > low[1]
is_ll = high < high[1] and low < low[1]

// Order Block Detection - Enhanced
bullish_ob = ta.lowest(low, 3) == low[1] and close[1] > open[1] and close > close[1]
bearish_ob = ta.highest(high, 3) == high[1] and close[1] < open[1] and close < close[1]

// Fair Value Gap Detection
fvg_up = low[2] > high[1] and close > high[2]
fvg_down = high[2] < low[1] and close < low[2]

// Multi-timeframe trend alignment
htf_trend_up = htf_close > htf_close[5]
htf_trend_down = htf_close < htf_close[5]

// Liquidity Zone Detection (Recent Swing Highs/Lows)
recent_high = ta.highest(high, 20)
recent_low = ta.lowest(low, 20)

// Entry Conditions with improved logic
long_entry = htf_trend_up and bullish_ob and (fvg_up or is_hh) and close > recent_low
short_entry = htf_trend_down and bearish_ob and (fvg_down or is_ll) and close < recent_high

// Exit Conditions (Based on opposite signals or fixed TP/SL)
take_profit_percent = input.float(3.0, "Take Profit %", minval=0.5, maxval=10.0)
stop_loss_percent = input.float(1.5, "Stop Loss %", minval=0.5, maxval=5.0)

// Strategy Execution
if long_entry and strategy.opentrades == 0
    strategy.entry("Long", strategy.long)
    strategy.exit("Long Exit", "Long", profit=close * (1 + take_profit_percent/100), loss=close * (1 - stop_loss_percent/100))

if short_entry and strategy.opentrades == 0
    strategy.entry("Short", strategy.short) 
    strategy.exit("Short Exit", "Short", profit=close * (1 - take_profit_percent/100), loss=close * (1 + stop_loss_percent/100))

// Alternative exit on opposite signal
if long_entry and strategy.position_size < 0
    strategy.close_all()
    
if short_entry and strategy.position_size > 0  
    strategy.close_all()

// Plotting
plotshape(long_entry, style=shape.triangleup, location=location.belowbar, color=color.green, size=size.normal, title="Long Signal")
plotshape(short_entry, style=shape.triangledown, location=location.abovebar, color=color.red, size=size.normal, title="Short Signal")

//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
h = input.float(8.,'Bandwidth', minval = 0)
mult = input.float(3., minval = 0)
src = input(close, 'Source')

repaint = input(true, 'Repainting Smoothing', tooltip = 'Repainting is an effect where the indicators historical output is subject to change over time. Disabling repainting will cause the indicator to output the endpoints of the calculations')

upCss = input.color(color.new(color.green, 0), 'Upper Line Color')
dnCss = input.color(color.new(color.red, 0), 'Lower Line Color')

//-----------------------------------------------------------------------------}
//Functions
//-----------------------------------------------------------------------------{
//Gaussian window
gauss(x, h) => math.exp(-(math.pow(x, 2)/(h * h * 2)))

//-----------------------------------------------------------------------------}
//Append lines
//-----------------------------------------------------------------------------{
n = bar_index

var ln = array.new_line(0) 

if barstate.isfirst and repaint
    for i = 0 to 499
        array.push(ln,line.new(na,na,na,na))

//-----------------------------------------------------------------------------}
//End point method
//-----------------------------------------------------------------------------{
var coefs = array.new_float(0)
var den = 0.

if barstate.isfirst and not repaint
    for i = 0 to 499
        w = gauss(i, h)
        coefs.push(w)

    den := coefs.sum()

out = 0.
if not repaint
    for i = 0 to 499
        out += src[i] * coefs.get(i)
out /= den
mae = ta.sma(math.abs(src - out), 499) * mult

upper = out + mae
lower = out - mae
 

//-----------------------------------------------------------------------------}
//Dashboard
//-----------------------------------------------------------------------------{
var tb = table.new(position.top_right, 1, 1
  , bgcolor = #1e222d
  , border_color = #373a46
  , border_width = 1
  , frame_color = #373a46
  , frame_width = 1)

if repaint
    tb.cell(0, 0, 'Repainting Mode Enabled', text_color = color.white, text_size = size.small)

// Plot liquidity zones
plot(recent_high, "Recent High", color=color.red, linewidth=1)
plot(recent_low, "Recent Low", color=color.green, linewidth=1)
//hline(recent_low, "Recent Low", color=color.green, linestyle=hline.style_dashed)
plot(repaint ? na : out + mae, 'Upper', upCss)
plot(repaint ? na : out - mae, 'Lower', dnCss)

// FVG Visualization
bgcolor(fvg_up ? color.new(color.green, 90) : na)
bgcolor(fvg_down ? color.new(color.red, 90) : na)

// Performance tracking
var table perf_table = table.new(position.top_right, 3, 4, bgcolor=color.white, border_width=1)
if barstate.islast and use_500_bars
    table.cell(perf_table, 0, 0, "Strategy Info", text_color=color.black, bgcolor=color.gray)
    table.cell(perf_table, 1, 0, "Value", text_color=color.black, bgcolor=color.gray)
    table.cell(perf_table, 0, 1, "Bars Used", text_color=color.black)
    table.cell(perf_table, 1, 1, str.tostring(max_bars), text_color=color.blue)
    table.cell(perf_table, 0, 2, "Trend TF", text_color=color.black)
    table.cell(perf_table, 1, 2, mtf_trend, text_color=color.blue)
    table.cell(perf_table, 0, 3, "Entry TF", text_color=color.black)
    table.cell(perf_table, 1, 3, entry_tf, text_color=color.blue)

