
var self = this,
    g, titleHeight = this.getTitleHeight(startup),
    cx = startup.radius + this.BUBBLE_PADDING,
    cy = startup.radius + titleHeight,
    x = startup.x - cx + this.left,
    y = startup.y - cy + this.top,
    len = startup.round_radiuses.length,
    color = Categories[startup.category_code].color,
    strokeColor = d3.rgb(color).darker(1.5),
    textColor = color;
g = this.chart.select(".bubbles").append("g").datum(startup).attr("class", "bubble").attr("width", (startup.radius + this.BUBBLE_PADDING) * 2).attr("height", startup.radius * 2 + this.BUBBLE_PADDING + titleHeight).attr("transform", "translate(" + x + "," + y + ")");
g.append("circle").attr("cx", cx).attr("cy", cy).attr("r", startup.radius).attr("fill", "url(" + self.getGradientUrl(startup.category_code) + ")");
var roundData = _.map(startup.funding_rounds, function (round, i) {
    return {
        radius: startup.round_radiuses[i],
        index: i
    }
}).reverse();
g.selectAll(".bubble-round").data(roundData).enter().append("circle").attr("class", "bubble-round").attr("cx", cx).attr("cy", cy).attr("r", function (d) {
    return d.radius
}).style("stroke-width", 1.3).style("stroke", strokeColor).style("fill", "transparent").each(function (d) {
        if (self.startupView) {
            $(this).hover(_.bind(self.trigger, self, "bubbleRound:mouseenter", startup, d.index), _.bind(self.trigger, self, "bubbleRound:mouseleave", startup, d.index))
        } else {
            if (_.indexOf(startup.invested_rounds, d.index) !== -1) {
                d3.select(this).style("stroke-width", 3)
            }
        }
    });
var name = startup.name;
if (this.startups.length > 1) {
    name = startup.index + 1 + "." + name
}
var nameElement = g.append("text").attr("class", "bubble-name bubble-clickable").classed("visible", !! titleHeight).text(name).attr("text-anchor", "middle").attr("x", cx).attr("y", titleHeight - 5).style("fill", textColor).on("click", function () {
    self.trigger("bubble:click", startup)
});
if (!this.startupView) {
    var outer = this.chart.select(".bubble-outers").append("circle").attr("class", "bubble-clickable").attr("cx", startup.x + this.left).attr("cy", startup.y + this.top).attr("r", startup.radius).style("opacity", 0).on("click", function () {
        self.trigger("bubble:click", startup)
    });
    var node = outer.node();
    $(node).add(nameElement.node()).hover(_.bind(self.trigger, self, "bubble:mouseenter", startup), _.bind(self.trigger, self, "bubble:mouseleave", startup))
}
this.bubbles[startup.permalink] = g