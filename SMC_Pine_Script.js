// This Pine Script™ code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// GitHub https://github.com/Yuki-Ryu/SMC-Strategy#

//@version=6
strategy("SMC Hybrid Pro Strategy", shorttitle="SMC", overlay=true, 
     default_qty_type=strategy.percent_of_equity, 
     process_orders_on_close=true, 
     calc_on_every_tick=true, 
     initial_capital=1000, 
     default_qty_value=5, 
     pyramiding=0, 
     commission_type=strategy.commission.percent, 
     commission_value=0.02,
     max_bars_back=2000)

//import SKO_Yokai/SMClibrary/1 as SKO_Yokai

// ===== INPUT PARAMETERS =====
// Multi-Timeframe Settings
userTimeframe = timeframe.in_seconds(input.timeframe("", title = "Timeframe"))
mtf_trend = input.string("1D", 'userTimeframe', options=["1D", "4H", "1H"])
entry_tf = input.string("1H", 'userTimeframe', options=["4H", "1H", "15m"])
use_bar_limit = input.bool(true, "Use 2000 Bar Limit", group="Performance")
bar_limit = input.int(2000, "Max Bars", minval=500, maxval=5000, group="Performance")

// SMC Core Elements
show_ob = input.bool(true, "Show Order Blocks", group="Order Blocks")
ob_lookback = input.int(5, "OB Lookback Period", minval=3, maxval=10, group="Order Blocks")
show_fvg = input.bool(true, "Show FVGs", group="Fair Value Gaps")
show_liquidity = input.bool(true, "Show Liquidity Sweeps", group="Liquidity")
liq_agg = 10 - input.int(5, "Liquidity Aggressiveness", minval=2, maxval=8, group="Liquidity")

// Strategy Settings
enable_long = input.bool(true, "Enable Long Trades", group="Strategy")
enable_short = input.bool(true, "Enable Short Trades", group="Strategy")
tp_percent = input.float(3.0, "Take Profit %", minval=1.0, maxval=10.0, group="Strategy")
sl_percent = input.float(1.5, "Stop Loss %", minval=0.5, maxval=5.0, group="Strategy")
use_trailing = input.bool(false, "Use Trailing Stop", group="Strategy")

// ===== BAR LIMITING =====
if use_bar_limit and bar_index > bar_limit
    strategy.cancel_all()
    strategy.close_all()
    

// ===== MULTI-TIMEFRAME DATA =====
// Enhanced timeframe conversion function
timeframe_seconds(string tf) =>
    switch tf
        "1D" => 86400
        "12H" => 43200
        "8H" => 28800
        "6H" => 21600
        "4H" => 14400
        "2H" => 7200
        "1H" => 3600
        "30min" => 1800
        "15min" => 900
        "5min" => 300
        => 0

// Validate timeframes to prevent lower TF for trend
trend_tf_seconds = timeframe_seconds(mtf_trend)
entry_tf_seconds = timeframe_seconds(entry_tf)
current_tf_seconds = timeframe.in_seconds()

// Get HTF data with lookahead protection
htf_close = request.security(syminfo.tickerid, mtf_trend, close, barmerge.gaps_on, lookahead=barmerge.lookahead_off)
htf_high = request.security(syminfo.tickerid, mtf_trend, high, barmerge.gaps_on, lookahead=barmerge.lookahead_off)
htf_low = request.security(syminfo.tickerid, mtf_trend, low, barmerge.gaps_on, lookahead=barmerge.lookahead_off)
htf_open = request.security(syminfo.tickerid, mtf_trend, open, barmerge.gaps_on, lookahead=barmerge.lookahead_off)

// Entry TF data
entry_close = request.security(syminfo.tickerid, entry_tf, close, barmerge.gaps_on, lookahead=barmerge.lookahead_off)
entry_high = request.security(syminfo.tickerid, entry_tf, high, barmerge.gaps_on, lookahead=barmerge.lookahead_off)
entry_low = request.security(syminfo.tickerid, entry_tf, low, barmerge.gaps_on, lookahead=barmerge.lookahead_off)

// ===== CORE SMC DETECTION =====
// Market Structure
is_hh = high > high[1] and low >= low[1]
is_ll = high <= high[1] and low < low[1]
is_hl = high < high[1] and low > low[1]  // Structure break

// Enhanced Order Block Detection (from ICT Suite)
var float[] bullish_ob_zones = array.new<float>()
var float[] bearish_ob_zones = array.new<float>()

// Enhanced Order Block Detection with Multi-TF confirmation
//bullish_ob_htf = htf_low == ta.lowest(htf_low, 5) and htf_close > htf_open
//bearish_ob_htf = htf_high == ta.highest(htf_high, 5) and htf_close < htf_open

//bullish_ob_ltf = low == ta.lowest(low, 3) and close > open and volume > ta.sma(volume, 10)
//bearish_ob_ltf = high == ta.highest(high, 3) and close < open and volume > ta.sma(volume, 10)

// Order Block Detection - Enhanced
bullish_ob = ta.lowest(low, 3) == low[1] and close[1] > open[1] and close > close[1]
bearish_ob = ta.highest(high, 3) == high[1] and close[1] < open[1] and close < close[1]
//bullish_ob = (bullish_ob_htf or bullish_ob_ltf) and close > close[1]
//bearish_ob = (bearish_ob_htf or bearish_ob_ltf) and close < close[1]

//lowerBand := lowerBand > prevLowerBand or close[1] < prevLowerBand ? lowerBand : prevLowerBand
//upperBand := upperBand < prevUpperBand or close[1] > prevUpperBand ? upperBand : prevUpperBand
    
//bullish_ob = low == ta.lowest(low, ob_lookback) and close > open and volume > ta.sma(volume, 10)
//bearish_ob = high == ta.highest(high, ob_lookback) and close < open and volume > ta.sma(volume, 10)

if bullish_ob
    array.push(bullish_ob_zones, low)
    if array.size(bullish_ob_zones) > 5
        array.shift(bullish_ob_zones)

if bearish_ob
    array.push(bearish_ob_zones, high)
    if array.size(bearish_ob_zones) > 5
        array.shift(bearish_ob_zones)

// Fair Value Gap Detection (Enhanced)
fvg_up = low[2] > high[1] and close > high[2] and barstate.isconfirmed
fvg_down = high[2] < low[1] and close < low[2] and barstate.isconfirmed

// Liquidity Sweep Detection (from ICT Suite)
liquidity_sweep_up = high > ta.highest(high, liq_agg)[1] and close < open
liquidity_sweep_down = low < ta.lowest(low, liq_agg)[1] and close > open

// ===== TREND ANALYSIS =====
// Multi-timeframe trend alignment
htf_trend_up = htf_close > ta.ema(htf_close, 20) and htf_close > htf_close[5]
htf_trend_down = htf_close < ta.ema(htf_close, 20) and htf_close < htf_close[5]

// Entry TF trend confirmation
entry_trend_up = entry_close > ta.ema(entry_close, 14)
entry_trend_down = entry_close < ta.ema(entry_close, 14)

// Volume confirmation
volume_confirm = volume > ta.sma(volume, 20)

// ===== LIQUIDITY ZONES =====
recent_high = ta.highest(high, 20)
recent_low = ta.lowest(low, 20)
htf_recent_high = ta.highest(htf_high, 10)
htf_recent_low = ta.lowest(htf_low, 10)

// ===== ENTRY CONDITIONS =====
// Enhanced Long Entry (Combining multiple confirmations)
long_entry = enable_long and htf_trend_up and entry_trend_up and (bullish_ob or fvg_up) and close > recent_low and not liquidity_sweep_down and volume_confirm and strategy.opentrades == 0

// Enhanced Short Entry
short_entry =     enable_short and    htf_trend_down and     entry_trend_down and    (bearish_ob or fvg_down) and    close < recent_high and    not liquidity_sweep_up and    volume_confirm and    strategy.opentrades == 0

// ===== STRATEGY EXECUTION =====
if long_entry
    strategy.entry("Long", strategy.long)
    if use_trailing
        strategy.exit("Long Exit", "Long",             trail_points=close * sl_percent/100,             trail_offset=close * tp_percent/100)
    else
        strategy.exit("Long Exit", "Long",             limit=close * (1 + tp_percent/100),             stop=close * (1 - sl_percent/100))

if short_entry
    strategy.entry("Short", strategy.short)
    if use_trailing
        strategy.exit("Short Exit", "Short",             trail_points=close * sl_percent/100,             trail_offset=close * tp_percent/100)
    else
        strategy.exit("Short Exit", "Short",             limit=close * (1 - tp_percent/100),             stop=close * (1 + sl_percent/100))

// ===== VISUALIZATION =====
// Order Block Visualization
plotshape(show_ob and bullish_ob, style=shape.triangleup, location=location.belowbar, 
         color=color.new(color.green, 0), size=size.small, title="Bullish OB")
plotshape(show_ob and bearish_ob, style=shape.triangledown, location=location.abovebar, 
         color=color.new(color.red, 0), size=size.small, title="Bearish OB")

// FVG Visualization
bgcolor(show_fvg and fvg_up ? color.new(color.green, 90) : na, title="FVG Up")
bgcolor(show_fvg and fvg_down ? color.new(color.red, 90) : na, title="FVG Down")

// Liquidity Sweep Visualization
plotshape(show_liquidity and liquidity_sweep_up, style=shape.labelup, 
         location=location.abovebar, color=color.new(color.orange, 80), 
         size=size.small, title="Liquidity Sweep Up")
plotshape(show_liquidity and liquidity_sweep_down, style=shape.labeldown, 
         location=location.belowbar, color=color.new(color.purple, 80), 
         size=size.small, title="Liquidity Sweep Down")

// Entry Signals
plotshape(long_entry, style=shape.triangleup, location=location.belowbar, 
         color=color.new(color.lime, 0), size=size.normal, title="Long Entry")
plotshape(short_entry, style=shape.triangledown, location=location.abovebar, 
         color=color.new(color.fuchsia, 0), size=size.normal, title="Short Entry")

// Liquidity Zones
plot(recent_high, "Recent High", color=color.red, linewidth=1, style=plot.style_circles)
plot(recent_low, "Recent Low", color=color.green, linewidth=1, style=plot.style_circles)
plot(htf_recent_high, "HTF High", color=color.maroon, linewidth=2)
plot(htf_recent_low, "HTF Low", color=color.teal, linewidth=2)

// ===== PERFORMANCE DASHBOARD =====
var table dashboard = table.new(position.top_right, 3, 8,     bgcolor=color.new(#1e222d, 90),     border_width=1,     frame_color=#363843)

if barstate.islast
    // Header
    table.cell(dashboard, 0, 0, "SMC HYBRID PRO", text_color=color.white, bgcolor=color.blue)
    
    // Timeframe Info
    table.cell(dashboard, 0, 1, "Trend TF:", text_color=color.white)
    table.cell(dashboard, 1, 1, mtf_trend, text_color=color.yellow)
    //table.cell(dashboard, 2, 1, str.tostring(timeframe_seconds(mtf_trend)/3600, "#.#") + "H", text_color=color.lime)
    table.cell(dashboard, 0, 2, "Entry TF:", text_color=color.white)
    table.cell(dashboard, 1, 2, entry_tf, text_color=color.yellow)
    //table.cell(dashboard, 2, 2, str.tostring(timeframe_seconds(entry_tf)/60, "#") + "min", text_color=color.lime)
    
    // Performance
    table.cell(dashboard, 0, 3, "Trades:", text_color=color.white)
    table.cell(dashboard, 1, 3, str.tostring(strategy.closedtrades), text_color=color.orange)
    
    table.cell(dashboard, 0, 4, "Win Rate:", text_color=color.white)
    win_rate = strategy.wintrades / math.max(1, strategy.closedtrades) * 100
    table.cell(dashboard, 1, 4, str.tostring(win_rate, "#.##") + "%", text_color=color.orange)
    
    table.cell(dashboard, 0, 5, "Profit:", text_color=color.white)
    profit_color = switch math.sign(strategy.netprofit)    

        1  =>   #74ffbc  
        -1 =>   color.red  
        =>   color.white

    table.cell(dashboard, 1, 5, str.tostring(strategy.netprofit, format.percent), text_color=profit_color)

    // Current Market State
    table.cell(dashboard, 0, 6, "Trend:", text_color=color.white) 
    trend_status = htf_trend_up ? "BULLISH" : htf_trend_down ? "BEARISH" : "RANGING"
    trend_color = htf_trend_up ? color.lime : htf_trend_down ? color.red : color.gray
    table.cell(dashboard, 1, 6, trend_status, text_color=trend_color)
    
    // Active Signals
    table.cell(dashboard, 0, 7, "Signals:", text_color=color.white)
    active_signals = ""
    active_signals := long_entry ? "LONG " : active_signals
    active_signals := short_entry ? active_signals + "SHORT" : active_signals
    active_signals := active_signals == "" ? "NONE" : active_signals
    table.cell(dashboard, 1, 7, active_signals, text_color=color.yellow)

// ===== ALERTS =====
alertcondition(long_entry, "SMC Hybrid Long Entry", 
               "SMC Hybrid Long Entry Signal - {{ticker}}")
alertcondition(short_entry, "SMC Hybrid Short Entry", 
               "SMC Hybrid Short Entry Signal - {{ticker}}")

// ===== PLOT STYLING =====
// Add some styling for better visibility
bgcolor(htf_trend_up ? color.new(color.green, 97) : htf_trend_down ? color.new(color.red, 97) : na)

// Current price line
plot(close, "Close", color=color.white, linewidth=1, style=plot.style_line)