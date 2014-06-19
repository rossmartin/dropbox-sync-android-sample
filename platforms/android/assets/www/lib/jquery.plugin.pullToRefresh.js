/*!
* jquery.plugin.pullToRefresh.js
* version 1.0
* author: Damien Antipa
* https://github.com/dantipa/pull-to-refresh-js
*/
(function( $ ){

    $.fn.pullToRefresh = function( options, iScroll ) { // added iScroll param, can't pass it in options object literal

		var isTouch = !!('ontouchstart' in window),
			cfg = $.extend(true, {
                message: {
                    pull: 'Pull to refresh',
                    release: 'Release to refresh',
                    loading: 'Loading...'
                }
			}, options),
			html = '<li><div class="pull-to-refresh">' +
				'<div class="icon"></div>' +
				'<div class="message">' +
					'<i class="arrow"></i>' +
                    '<div class="topcoat-spinner spinner large"></div>' +
//					'<i class="spinner large"></i>' +
					'<span class="pull">' + cfg.message.pull + '</span>' +
					'<span class="release">' + cfg.message.release + '</span>' +
					'<span class="loading">' + cfg.message.loading + '</span>' +
				  '</div>' +
				'</div></li>';

		return this.each(function() {
			if (!isTouch) {
				return;
			}
            
            if ($('.topcoat-list div.pull-to-refresh', $(this)).length > 0) {
                return;
            }

			//var e = $(this).prepend(html),
            var e = $(this).find('.topcoat-list').prepend(html),
				//content = e.find('.wrap'),
                content = $(this),
				ptr = e.find('.pull-to-refresh'),
				arrow = e.find('.arrow'),
				spinner = e.find('.spinner'),
				pull = e.find('.pull'),
				release = e.find('.release'),
				loading = e.find('.loading'),
				ptrHeight = ptr.height(),
				arrowDelay = ptrHeight / 3 * 2,
				isActivated = false,
				isLoading = false;

			/*content.on('touchstart', function (ev) {
				if (e.scrollTop() === 0) { // fix scrolling
					//e.scrollTop(1);
				}
			})*/
            content.on('touchmove', function (ev) {
				//var top = e.scrollTop(),
                var top = -1 * iScroll.y,
					deg = 180 - (top < ptrHeight ? 180 : // degrees to move for the arrow (starts at 180° and decreases)
						  (top < -arrowDelay ? Math.round(180 / (ptrHeight - arrowDelay) * (-top - arrowDelay)) 
						  : 0));

				if (isLoading) { // if is already loading -> do nothing
					return true;
				}

				arrow.show();
				arrow.css('transform', 'rotate('+ deg + 'deg)'); // move arrow

				spinner.hide();

				if (-top > ptrHeight) { // release state
					release.css('opacity', 1);
					pull.css('opacity', 0);
					loading.css('opacity', 0);

					isActivated = true;
                    e.css('margin-top', '0px');
				} else if (top > -ptrHeight) { // pull state
					release.css('opacity', 0);
					loading.css('opacity', 0);
					pull.css('opacity', 1);

					isActivated = false;
				}
			}).on('touchend', function(ev) {
				//var top = e.scrollTop();
                var top = -1 * iScroll.y;
				
				if (isActivated) { // loading state
					isLoading = true;
					isActivated = false;

					release.css('opacity', 0);
					pull.css('opacity', 0);
					loading.css('opacity', 1);
					arrow.hide();
					spinner.show();

					ptr.css('position', 'static');

					cfg.callback().done(function() {
						ptr.animate({
							/*height: 10*/
						}, 'fast', 'linear', function () {
							/*ptr.css({
								position: 'absolute',
								height: ptrHeight
							});*/
							isLoading = false;
                            e.css('margin-top', '-50px');
						});
					});
				}
			});
		});

	};
})( jQuery );