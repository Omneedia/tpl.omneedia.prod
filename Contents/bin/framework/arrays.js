module.exports = function() {
    Array.prototype.getFields = function(field) {
        return this.map(function(o) {
            return o[field];
        });
    };

    Array.prototype.equals = function(array) {
        // if the other array is a falsy value, return
        if (!array)
            return false;

        // compare lengths - can save a lot of time 
        if (this.length != array.length)
            return false;

        for (var i = 0, l = this.length; i < l; i++) {
            // Check if we have nested arrays
            if (this[i] instanceof Array && array[i] instanceof Array) {
                // recurse into the nested arrays
                if (!this[i].equals(array[i]))
                    return false;
            } else if (this[i] != array[i]) {
                // Warning - two different object instances will never be equal: {x:20} != {x:20}
                return false;
            }
        }
        return true;
    };

    Array.prototype.diff = function(a) {
        return this.filter(function(i) { return a.indexOf(i) < 0; });
    };

    Array.prototype.query = function(sql) {
        return alasql(sql, [this]);
    };

    Array.prototype.render = function(tplx) {

        var me = this;
        var newstring = "";

        function replace(items, tpl) {
            for (var el in tpl) {
                if (items.indexOf('{' + el + '}') > -1) {
                    if (!tpl[el]) tpl[el] = "";
                    items = items.replaceAll('{' + el + '}', tpl[el]);
                }
            };
            return items;
        };

        if (!Array.isArray(tplx)) {
            var tab = [];
            tab.push(tplx);
            tplx = tab;
        };

        for (var i = 0; i < tplx.length; i++) {
            newstring += replace(this.join(''), tplx[i]);
        };

        return newstring;
    };

    Array.prototype.remove = function() {
        var what, a = arguments,
            L = a.length,
            ax;
        while (L && this.length) {
            what = a[--L];
            while ((ax = this.indexOf(what)) !== -1) {
                this.splice(ax, 1);
            }
        }
        return this;
    };
    return Array;
}