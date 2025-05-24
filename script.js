// script.js
"use strict";

const PRIZES = [
    { id: 1, name: '体验券', prob: 78.0, desc: '免费体验台球1小时' },
    { id: 2, name: '店长特训', prob: 18.0, desc: '店长一对一指导1小时', dailyLimit: 2 },
    { id: 3, name: '周会员', prob: 3.9,  desc: '一周会员资格', weeklyLimit: 1 },
    { id: 4, name: '专属球杆', prob: 0.1, desc: '定制台球杆一支', monthlyLimit: 1 }
];

const clockwiseOrder = [0, 1, 2, 5, 8, 7, 6, 3];
const prizeIndexMap = { 1:0, 2:2, 3:6, 4:8 };

class Lottery {
    constructor(element) {
        this.$element = $(element);
        this.$items = this.$element.find('.lot-item').not('.lot-btn');
        this.$button = this.$element.find('.lot-btn');
        this.historyLimit = 50;
        this.usedCards = new Set();
        this.currentCard = null;
        this.audioPool = [];
        this.initStorage();
        this.initAudio();
        this.init();
        this.bindEvents();
    }

    initStorage() {
        try {
            this.history = JSON.parse(localStorage.getItem('lotteryHistory') || '[]');
            const savedCards = JSON.parse(localStorage.getItem('usedCards') || '[]');
            this.usedCards = new Set(savedCards);
            this.updateHistoryDisplay();
        } catch(e) {
            console.error('本地存储读取失败:', e);
            this.history = [];
            this.usedCards = new Set();
        }
    }

    initAudio() {
        for(let i = 0; i < 5; i++) {
            const clickAudio = new Audio('./click.mp3');
            this.audioPool.push(clickAudio);
        }
        this.winAudio = new Audio('./win.mp3');
    }

    init() {
        this.isDrawing = false;
        this.speed = 80;
        this.currentIndex = 0;
        this.audioIndex = 0;
    }

    updateHistoryDisplay() {
        const $list = $('.history-list').empty();
        this.history.slice(-5).reverse().forEach(record => {
            $list.append(`
                <div class="history-item">
                    <span>${record.card} - ${record.name}</span>
                    <button class="copy-btn">📋</button>
                </div>
            `);
        });
    }

    bindEvents() {
        const playClick = () => {
            if(!this.isDrawing) this.playSound('click');
        };
        
        $(document).on('click', [
            '.lot-item',
            '.lot-btn',
            '.confirm-card',
            '.clear-history',
            '.copy-btn',
            '.prize-item',
            '.action-btn'
        ].join(','), playClick);

        $('.action-btn').on({
            mouseenter: function() {
                $(this).css('transform', 'translateY(-2px)');
            },
            mouseleave: function() {
                $(this).css('transform', 'translateY(0)');
            },
            click: function(e) {
                $(e.currentTarget).css('transform', 'scale(0.95)');
                setTimeout(() => $(e.currentTarget).css('transform', 'scale(1)'), 200);
            }
        });

        this.$button.on('click', () => this.showCardModal());
        
        $(document).on('click', '.copy-btn', (e) => {
            const text = $(e.target).prev().text().split(' - ')[0];
            navigator.clipboard.writeText(text);
        });

        $('.clear-history').on('click', () => {
            this.history = [];
            localStorage.removeItem('lotteryHistory');
            this.updateHistoryDisplay();
            this.showAlert('记录已清空');
        });

        $(document).on('click', '.prize-item', (e) => {
            const prizeId = $(e.currentTarget).data('prize');
            const prize = PRIZES.find(p => p.id == prizeId);
            if(prize) {
                this.showAlert(`奖项说明：${prize.desc}`);
            }
        });
    }

    checkPrizeLimit(prize) {
        const now = new Date();
        const history = this.history.filter(r => r.id === prize.id);
        
        switch(prize.id) {
            case 2: {
                const todayStart = new Date(now);
                todayStart.setHours(0,0,0,0);
                return history.filter(r => 
                    new Date(r.timestamp) >= todayStart
                ).length < prize.dailyLimit;
            }
            case 3: {
                const nowCopy = new Date(now);
                const weekStart = new Date(nowCopy.setDate(nowCopy.getDate() - nowCopy.getDay()));
                weekStart.setHours(0,0,0,0);
                return history.filter(r => 
                    new Date(r.timestamp) >= weekStart
                ).length < prize.weeklyLimit;
            }
            case 4: {
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                return history.filter(r => 
                    new Date(r.timestamp) >= monthStart
                ).length < prize.monthlyLimit;
            }
            default:
                return true;
        }
    }

    async getPrize() {
        return new Promise(resolve => {
            const random = Math.random() * 100;
            let accum = 0;
            
            for (const p of PRIZES) {
                accum += p.prob;
                if (random <= accum) {
                    if(this.checkPrizeLimit(p)) {
                        resolve(p);
                    } else {
                        resolve(PRIZES[0]);
                    }
                    return;
                }
            }
            resolve(PRIZES[0]);
        });
    }

    runAnimation(prize) {
        return new Promise(resolve => {
            const targetIndex = prizeIndexMap[prize.id];
            const totalSteps = 32 + Math.floor(8 * Math.random());
            let currentStep = 0;
            let cycleCount = 0;

            const animate = () => {
                this.$items.removeClass('active');
                const currentPos = clockwiseOrder[cycleCount % clockwiseOrder.length];
                this.$items.eq(currentPos).addClass('active');

                if (currentStep++ < totalSteps) {
                    this.speed = Math.min(this.speed + 3, 140);
                    cycleCount++;
                    setTimeout(animate, this.speed);
                } else {
                    this.$items.removeClass('active');
                    this.$items.eq(targetIndex).addClass('active');
                    resolve();
                }
            };
            animate();
        });
    }

    showAlert(message) {
        $('<div class="alert-message">'+message+'</div>')
            .appendTo('body')
            .delay(2000)
            .fadeOut(300, () => $(this).remove());
    }

    showCardModal() {
        if(this.isDrawing) return;
        
        const modal = $(`
            <div class="modal-wrapper">
                <div class="modal-content">
                    <div class="modal-body">
                        <h3 style="margin-bottom:15px;text-align:center">请输入卡密</h3>
                        <input type="text" class="card-input" placeholder="输入卡密开始抽奖" maxlength="18">
                        <div style="margin-top:20px;text-align:center">
                            <button class="confirm-card action-btn">确认抽奖</button>
                        </div>
                    </div>
                </div>
            </div>
        `).appendTo('body');

        modal.on('click', function(e) {
            if ($(e.target).hasClass('modal-wrapper')) {
                $(this).fadeOut(200, () => $(this).remove());
            }
        });

        $('.confirm-card').on('click', () => {
            const card = $('.card-input').val().trim().toUpperCase();
            if(this.validateCard(card)) {
                this.currentCard = card;
                modal.remove();
                this.start();
            }
        });
    }

    validateCard(card) {
        const regex = /^\d{12}[A-Z]{6}$/;
        if(!regex.test(card)) {
            this.showAlert('卡密格式错误');
            return false;
        }
        
        const timePart = card.slice(0, 12);
        const now = new Date();
        
        const year = parseInt(timePart.slice(0,4)),
              month = parseInt(timePart.slice(4,6)) - 1,
              day = parseInt(timePart.slice(6,8)),
              hour = parseInt(timePart.slice(8,10)),
              minute = parseInt(timePart.slice(10,12));
        const cardDate = new Date(year, month, day, hour, minute);

        if (
            cardDate.getFullYear() !== now.getFullYear() ||
            cardDate.getMonth() !== now.getMonth() ||
            cardDate.getDate() !== now.getDate()
        ) {
            this.showAlert('卡密已过期');
            return false;
        }

        const timeDiff = now - cardDate;
        if (timeDiff < 0 || timeDiff > 300000) {
            this.showAlert('卡密已失效');
            return false;
        }

        if(this.usedCards.has(card)) {
            this.showAlert('卡密已使用');
            return false;
        }
        
        this.usedCards.add(card);
        localStorage.setItem('usedCards', JSON.stringify([...this.usedCards]));
        return true;
    }

    async start() {
        this.isDrawing = true;
        this.$button.addClass('disabled');

        const prize = await this.getPrize();
        await this.runAnimation(prize);
        this.showResult(prize);
        this.recordHistory(prize);

        this.isDrawing = false;
        this.$button.removeClass('disabled');
    }

    playSound(type) {
        if(type === 'click') {
            const audio = this.audioPool[this.audioIndex];
            this.audioIndex = (this.audioIndex + 1) % this.audioPool.length;
            audio.currentTime = 0;
            audio.play().catch(e => console.log('点击音效失败:', e));
        } else {
            this.winAudio.currentTime = 0;
            this.winAudio.play().catch(e => console.log('中奖音效失败:', e));
        }
    }

    showResult(prize) {
        this.playSound('win');
        const $modal = $(`
            <div class="modal-wrapper">
                <div class="modal-content">
                    <div class="result-body" style="padding:25px;text-align:center">
                        <h2 style="margin:0 0 15px;font-size:24px">🎉 恭喜中奖！</h2>
                        <div style="padding:15px;background:rgba(255,255,255,0.1);border-radius:8px">
                            <p style="font-size:18px;margin:10px 0"><strong>${prize.name}</strong></p>
                            <p style="color:#ccc;margin:0">${prize.desc}</p>
                        </div>
                    </div>
                </div>
            </div>
        `).appendTo('body');

        $modal.on('click', function(e) {
            if ($(e.target).hasClass('modal-wrapper')) {
                $(this).fadeOut(200, () => $(this).remove());
            }
        });
    }

    recordHistory(prize) {
        try {
            this.history = [...this.history, { 
                card: this.currentCard,
                name: prize.name,
                id: prize.id,
                timestamp: Date.now()
            }].slice(-this.historyLimit);
            localStorage.setItem('lotteryHistory', JSON.stringify(this.history));
            this.updateHistoryDisplay();
        } catch(e) {
            console.error('存储失败:', e);
        }
    }
}

$.fn.lottery = function() {
    return this.each(function() {
        if (!$.data(this, 'lottery')) {
            new Lottery(this);
        }
    });
};

$(function() {
    $('.lot-grid').lottery();

    window.showCardInfo = function() {
        const modal = $(`
            <div class="modal-wrapper">
                <div class="modal-content">
                    <div class="modal-body">
                        <p>此活动只针对站长好友开放</p>
                        <p>需赞赏后获取卡密：中奖率100%</p>
                        <div class="wechat-row">
                            <span>复制站长微信</span>
                            <button class="copy-btn">📋 复制</button>
                        </div>
                    </div>
                </div>
            </div>
        `).appendTo('body');

        modal.on('click', function(e) {
            if ($(e.target).hasClass('modal-wrapper')) {
                $(this).fadeOut(200, () => $(this).remove());
            }
        });

        modal.find('.copy-btn').on('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText('LIVE-CS2025')
                .then(() => $('<div class="alert-message">微信号已复制</div>')
                    .appendTo('body').delay(2000).fadeOut(300, function() { 
                        $(this).remove(); 
                    }))
                .catch(err => console.error('复制失败:', err));
        });
    };

    window.showQRCode = function() {
        const modal = $(`
            <div class="modal-wrapper">
                <div class="modal-content">
                    <div class="qrcode-body">
                        <h3>赞赏支持</h3>
                        <img src="qrcode.jpg" alt="赞赏二维码" style="max-width:100%">
                        <p>扫码赞赏后联系站长核验</p>
                    </div>
                </div>
            </div>
        `).appendTo('body');

        modal.on('click', function(e) {
            if ($(e.target).hasClass('modal-wrapper')) {
                $(this).fadeOut(200, () => $(this).remove());
            }
        });
    };
});
