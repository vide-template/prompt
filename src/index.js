import path from 'path'

// 默认集成的变量
let integratedContexts = {}
let integratedWords = []
let integratedMatch = {}

// 每一个文件的值
let words = []
let wordsMatch = {}
let currentContext = {}

let prevPromptStr = ''
let prevPromptLists = []

function loadIntegratedWords () {
  // 集成默认的输入
}

function analyseContent (con) {
  let reg = /([a-zA-Z_\$][a-zA-Z0-9_\$]{3,})/g
  let arr = con.match(reg)
  if (!arr) {
    return
  }
  arr.forEach((item) => {
    if (!wordsMatch[item] && !integratedMatch[item]) {
      words.push(item)
      wordsMatch[item] = 1
    }
  })
}

function getTypedCharacters (action, store, editor) {
  if (action.action == 'remove' && !store.state.editor.promptLists.length) {
    return ''
  }
  if (action && action.lines.length === 1 && /^\S+$/.test(action.lines[0]) && action.start.row != undefined && action.start.row == action.end.row) {
    let session = editor.session
    let line = session.getLine(action.start.row)
    let str
    let after_adding_letter = ""
    
    if (action.action == 'insert' && action.lines[0].length == 1) {
      str = line.slice(0, action.end.column)
      after_adding_letter = line.slice(action.end.column, action.end.column + 1)
    } else if (action.action == 'remove' && action.lines[0].length == 1) {
      str = line.slice(0, action.start.column)
      after_adding_letter = line.slice(action.start.column, action.start.column + 1)
    } else {
      return ''
    }
    
    // if after adding letter,there is a legal letter,it means we are editing in a word,
    if (after_adding_letter && /[a-zA-Z0-9_$]+$/.test(after_adding_letter)) {
      return ''
    }
    
    let value = str.match(/[a-zA-Z_\$][a-zA-Z0-9_$\.\-\:]*$/)
    if (value && value[0]) {
      value = value[0]
      let splitChar = value.includes(':') ? ':' : '.'
      let arr = value.split(splitChar)
      if (arr.length === 2) {
        if (integratedContexts[arr[0]] || currentContext[arr[0]]) {
          value = {
            context: arr[0],
            value: arr[1]
          }
        } else {
          value = arr[1]
        }
      } else {
        value = arr.pop()
      }
    }
    return value ? value : '';
  } else {
    return ''
  } 
}

function matchWords (str) {
  str = str.replace('$','\\$')
  let reg = new RegExp('^' + str, 'i')
  let lists = integratedWords.concat(words)
  if (prevPromptStr && str.slice(0, prevPromptStr.length) === prevPromptStr) {
      lists = prevPromptLists
  }
  let results = []
  results = lists.filter((item) => {
    if (item.value) {
      return reg.test(item.value) 
    } else {
      return reg.test(item)
    }
  })
  if (!results.length) {
    reg = new RegExp(str, 'i')
    results = lists.filter((item) => {
      if (item.value) {
        return reg.test(item.value) 
      } else {
        return reg.test(item)
      }
    })
  }
  results.sort(function (a,b){
    a = a.value || a
    b = b.value || b
    return a > b? 1 : -1;
  })
  return results
}

function matchContext (item) {
  let lists = integratedContexts[item.context] ? integratedContexts[item.context] : currentContext[item.context]
  if (item.value) {
    let str = item.value
    lists = lists.filter((item) => {
      let v = item.name || item.value || item
      return v.includes(str)
    })
  }
  return lists
}


export default ({editor, store, view, packageInfo, baseClass, signal, console}) => {
  global.console = console
  // load integrated words
  loadIntegratedWords()
  // subscribe change file
  store.subscribe((mutation, state) => {
    if (store.state.editor.promptName === '{{className}}') {
      if (['EDITOR_SET_FILE_TYPE','FILE_CREATE'].includes(mutation.type)) {
        analyseContent(store.state.editor.content)
      }
    }
  })

  editor.session.on('change', function (action) {
    if (store.state.editor.promptName === '{{className}}' && ["insert", "remove"].includes(action.action) && action.lines.join('') === '') {
      analyseContent(editor.getValue())
    }
  })
  
  signal.receive('saveFile', () => {
    if (store.state.editor.promptName === '{{className}}') {
      words = []
      wordsMatch = {}
      analyseContent(store.state.editor.content)
    }
  })
  // return execute class
  return class {{className}} {
    index ({action}) {
      let promptLists = []
      let promptStr = ''
      try {
        promptStr = getTypedCharacters(action, store, editor)
        if (promptStr && typeof promptStr === 'object') {
          promptLists = matchContext(promptStr)
          promptStr = promptStr.value
        } else if (promptStr) {
          promptLists = matchWords(promptStr)
        }
      } catch (e) {}
      if (promptLists.length) {
        prevPromptStr = promptStr
        prevPromptLists = promptLists
        store.dispatch('editor/setPromptLists', {promptStr, promptLists})
      } else {
        prevPromptStr = ''
        prevPromptLists = []
        store.dispatch('editor/cleanPromptLists')
      }
    }
    
    /*
    * 根据位置，查找函数定义
    */
    // mapping ({position}) {
    // }
    
    /*
    * 根据位置，查找函数说明
    */
    // mappingFunctionDesc ({position}) {
    // }
  }
}
