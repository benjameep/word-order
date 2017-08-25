var canvas = document.getElementById('canvas')
var ctx = canvas.getContext('2d')
ctx.roundRect = function(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
var grid, words, hasInit = false,
  mouseData = {}

function init(wordList) {
  if (!wordList.length)
    return
  wordList = format(wordList)
  grid = new Grid()
  words = new Words(wordList)
  words.formParagraph()
  draw()
  hasInit = true
  $('#usedWords').bind('input propertychange', () => words.setVisible($('#usedWords').val()))
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  //    grid.draw()
  words.draw()
}

function format(str) {
  return str.replace(/[^A-Za-z\s]/g, '').toLowerCase().trim().split(/\s+/)
}

class Grid {
  constructor() {
    this.cellWidth = 15
    this.cellHeight = 20
    this.width = canvas.width
    this.height = canvas.height
    this.x = 0
    this.y = canvas.height - this.height
  }
  draw() {
    ctx.strokeStyle = "#eee"
    ctx.beginPath()
    for (var i = 0; i < canvas.height; i += this.cellHeight) {
      ctx.moveTo(this.x, this.y + i)
      ctx.lineTo(this.x + this.width, this.y + i)
    }
    for (var i = 0; i < canvas.width; i += this.cellWidth) {
      ctx.moveTo(this.x + i, this.y)
      ctx.lineTo(this.x + i, this.y + this.height)
    }
    ctx.stroke()
  }
  nearestCell(x, y) {
    return {
      x: (x - this.x) / this.cellWidth | 0,
      y: (y - this.y) / this.cellHeight | 0,
      inside: x >= grid.x && y >= grid.y &&
        x < grid.x + grid.width &&
        y < grid.y + grid.height
    }
  }
  posToPix(x, y) {
    return {
      x: this.x + x * this.cellWidth,
      y: this.y + y * this.cellHeight
    }
  }
}

class Words {
  constructor(wordList) {
    this.wordList = wordList.map(word => new Word(word))
    this.visableWords = this.wordList.slice()
    this.lineLength = grid.width / grid.cellWidth | 0
    this.numLines = grid.height / grid.cellHeight | 0
  }
  formParagraph(type) {
    switch(type){
      case 'alph':
        this.visableWords.sort((a,b) => a.word<b.word?-1:a.word==b.word?0:1 )
        break
      case 'leng':
        this.visableWords.sort((a,b) => a.word<b.word?-1:a.word==b.word?0:1 )
        this.visableWords.sort((a,b) => a.length - b.length)
        break
      default:
        this.visableWords.sort((a,b) => this.wordList.indexOf(a) - this.wordList.indexOf(b))
        break
    }

    // position all my words
    var x = 0,
      y = 0
    this.visableWords.forEach(word => {
      if (x + word.length > this.lineLength) {y++;x = 0}
      Object.assign(word, { x: x, y: y })
      x += word.length
    })
    draw()
  }
  draw() {
    this.visableWords.forEach(x => !x.isFlying && x.draw())
  }
  absmin(a, b) {
    return Math.abs(a) < Math.abs(b) ? a : b
  }
  getWord(x, y, maxX) {
    return this.visableWords.filter(word => word.y == y && word.x <= x && word.x + word.length > x)[0]
  }
  getWords(min, max, y) {
    return this.visableWords.filter(word => word.y == y && !(word.x + word.length <= min || word.x >= max))
  }
  setVisible(text) {
    var list = format(text)
    this.visableWords = []
    this.wordList.forEach(word => {
      var index = list.indexOf(word.word)
      // If the word is in the list, then remove it from visableWords
      if (index != -1)
        list.splice(index, 1)
      else
        this.visableWords.push(word)
    })
    console.log(this.visableWords, list)
    document.getElementById('overused').innerHTML = list.join(' ')
    this.visableWords.forEach(w => this.stabalize(w))
    draw()
  }
  stabalize(word) {
    word.wrap()
    // If we are too crammed on this row
    if (this.visableWords.filter(w => w.y == word.y).reduce((a, b) => a + b.length, 0) > this.lineLength) {
      word.x = 0;
      word.y++
        if (word.y < this.numLines)
          this.stabalize(word)
      return
    }
    var overlapping = this.getWords(word.x, word.x + word.length, word.y).filter(x => x != word)
    if (!overlapping.length)
      return

    word.x += overlapping.reduce((champ, lap) => {
      var left = lap.x - (word.x + word.length)
      var right = (lap.x + lap.length) - word.x
      left = left + word.x >= 0 ? left : 100
      right = right + word.x + word.length < this.lineLength ? right : 100
      return this.absmin(champ, this.absmin(left, right))
    }, 100)

    this.getWords(word.x, word.x + word.length, word.y).filter(x => x != word).forEach(word => this.stabalize(word))
  }
}

class Word {
  constructor(word) {
    ctx.font = (grid.cellHeight * .8 | 0) + "px Arial"
    this.word = word
    this.length = Math.ceil(ctx.measureText(word).width / grid.cellWidth)
    this.corners = 3
    this.padding = (grid.cellWidth * this.length - ctx.measureText(word).width) / 2
    this.isFlying = false
  }
  wrap() {
    this.x += (this.x < 0) * -this.x
    if (this.x + this.length > words.lineLength) {
      this.y++;
      this.x = 0
    }
  }
  draw() {
    ctx.textBaseline = "middle"
    ctx.font = (grid.cellHeight * .8 | 0) + "px Arial"
    var pos = grid.posToPix(this.x, this.y)
    ctx.fillStyle = "#FF5400"
    ctx.strokeStyle = "#B23B00"
    ctx.roundRect(pos.x, pos.y, grid.cellWidth * this.length, grid.cellHeight, this.corners)
    ctx.fillStyle = "#000"
    ctx.fillText(this.word, pos.x + this.padding, pos.y + grid.cellHeight / 2)
  }
  flyingDraw(x, y) {
    ctx.fillStyle = "#B23B00"
    ctx.roundRect(x, y, grid.cellWidth * this.length, grid.cellHeight, this.corners)
    ctx.fillStyle = "#000"
    ctx.fillText(this.word, x + this.padding, y + grid.cellHeight / 2)
  }
}

window.onmousedown = function(e) {
  var x = e.x - $('canvas').offset().left
  var y = e.y - $('canvas').offset().top
  if (hasInit) {
    var pos = grid.nearestCell(x, y)
    var word = pos.inside && words.getWord(pos.x, pos.y)
    word = word && word.isFlying ? null : word
  }
  if (word) {
    word.isFlying = true
    mouseData.isDown = true
    mouseData.downX = pos.x
    mouseData.downY = pos.y
    mouseData.word = word
    mouseData.diffX = (grid.x + word.x * grid.cellWidth) - x
    mouseData.diffY = (grid.y + word.y * grid.cellHeight) - y
  }
}
window.onmousemove = function(e) {
  var x = e.x - $('canvas').offset().left
  var y = e.y - $('canvas').offset().top
  // update the x and y
  if (hasInit)
    Object.assign(mouseData, grid.nearestCell(x, y))
  if (mouseData.isDown) {
    // I'm flying
    draw()
    mouseData.word.flyingDraw(x + mouseData.diffX, y + mouseData.diffY)
  }
}
window.onmouseup = function(e) {
  var x = e.x - $('canvas').offset().left
  var y = e.y - $('canvas').offset().top
  if (mouseData.isDown && mouseData.inside) {
    // try to land in the new position
    var pos = grid.nearestCell(x + mouseData.diffX, y)
    mouseData.word.x = pos.x
    mouseData.word.y = pos.y
    words.stabalize(mouseData.word)
    mouseData.word.isFlying = false
  } else if (mouseData.isDown) {
    // return the block to it's prior position
    mouseData.word.isFlying = false
  }
  mouseData.isDown = false
  if (hasInit)
    draw()
}
