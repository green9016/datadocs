var parser = new formulaParser.Parser();
// var fomula = new Formula("S");

// var fomula3 = new Formula("SU(");
// var fomula4 = new Formula("SUM(2");
// var fomula5 = new Formula("SUM(2,");
// var fomula6 = new Formula("SUM(2,ADD(4,2),3*2)");

// console.log("====", fomula.getLastFunctionEvaluator());
// console.log("SUM=", fomula2);
// console.log("SUM(=", fomula3);
// console.log("SUM(2=", fomula4);
// console.log("SUM(2,=", fomula5);
// console.log("SUM(2,4=", fomula6);

function filterFuncListByName(name) {
  return FuncList.filter(func => func.name.toLowerCase().startsWith(name.toLowerCase()));
}

function getFuncData(name) {
  return FuncList.find(func => func.name.toLowerCase() == name.toLowerCase());
}

function showFuncListPopup(funclist) {
  const funclistPopup = document.getElementById("formula-list");
  funclistPopup.style.display = "block";
  funclistPopup.innerHTML = funclist.reduce((html, func) => 
    html + `<div class="formula-list-item" role="option" style="user-select: none;">
      <div class="formula-list-item-row" style="user-select: none;">
        <div class="formula-list-item-func-name" style="user-select: none;">
            ${func.name}
        </div>
        <div class="formula-list-item-func-desc" style="user-select: none;">
            ${func.desc}
        </div>
      </div>
    </div>
  `.trim(), "");
}

function hideFuncPopup() {
  const funclistPopup = document.getElementById("formula-list");
  funclistPopup.style.display = "none";
  const funcdetailPopup = document.getElementById("formula-help-popup");
  funcdetailPopup.style.display = "none";
}

function showFuncDetailPopup(funcData) {
  const funcdetailPopup = document.getElementById("formula-help-popup");
  funcdetailPopup.style.display = "block";
  funcdetailPopup.innerHTML = `
    <div
      class="formula-help-popup-title"
      role="tab"
      aria-expanded="true"
    >
      <div class="formula-help-popup-header">
        <span class="formula-help-popup-funcname">${funcData.name}</span>
        <bdo dir="ltr">
          <span class="formula-help-popup-example-paren">(</span>
          <span class="formula-help-popup-header-holder">
            ${funcData.params.reduce((html, param, idx) => 
              html + '<span class="formula-arguments-help-parameter" dir="auto">' + param.name + (idx < funcData.params.length - 1 ? ", " : "") +'</span>'
              , "")} 
          <span class="formula-help-popup-example-paren">)</span>
        </bdo>
      </div>
      <div class="formula-arguments-help-button-container">
        <div
          class="formula-arguments-help-button"
          role="button"
          tabindex="0"
          data-tooltip="Minimize (F1)"
          aria-label="Minimize (F1)"
          style="user-select: none;"
        >
          <div class="waffle-formula-help-button-hover-container">
            <div
              class="docs-icon goog-inline-block waffle-arguments-help-toggle-icon"
            >
              <div
                class="docs-icon-img-container docs-icon-img docs-icon-down"
                aria-hidden="true"
              >
                &nbsp;
              </div>
            </div>
          </div>
        </div>
        <div
          class="waffle-arguments-help-close waffle-arguments-help-button"
          role="button"
          tabindex="0"
          data-tooltip="Close (Shift-F1)"
          aria-label="Close (Shift-F1)"
          style="user-select: none;"
        >
          <div class="waffle-formula-help-button-hover-container">
            <div class="docs-icon goog-inline-block ">
              <div
                class="docs-icon-img-container docs-icon-img docs-icon-close"
                aria-hidden="true"
              >
                &nbsp;
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div style="overflow: hidden;">
      <div class="formula-help-popup-body">
        <div class="formula-help-popup-example">
          <div class="formula-help-popup-section-title">Example</div>
          <div class="formula-help-popup-example-holder">
            <div class="formula-help-popup-example-formula">
              <span class="formula-help-popup-example-func-name">${funcData.name}</span>` +
              `<bdo dir="ltr">` + 
                `<span class="formula-help-popup-example-paren">(</span>`+
                `<span class="formula-help-popup-example-args-holder">` +
                  `${funcData.example.params.reduce((html, param, idx) => 
                      html + '<span class="formula-arguments-help-parameter" dir="auto">' + param + '</span>' 
                      + (idx < funcData.example.params.length - 1 ? ', ' : ''), "")}` +
                `</span>` +
                `<span class="formula-help-popup-example-paren">)</span>` +
              `</bdo>` +
            `</div>
          </div>
        </div>
        <div class="formula-help-popup-content">
          <div>
            <div class="formula-help-popup-about">
              <div class="formula-help-popup-section-title">About</div>
              <span class="formula-help-popup-about-content">${funcData.about}</span>
            </div>
            <hr />
            <div class="formula-help-popup-parameter">
              ${funcData.params.reduce((html, param) => 
                  html + '<div class="formula-help-popup-parameter-section">\
                  <div class="formula-help-popup-parameter-section-title">'
                    + param.name
                + '</div>\
                  <span\
                    class="formula-help-popup-parameter-section-content">'
                    + param.desc
                + '</span>\
                </div>'
              , "")}
            </div>
          </div>
        </div>
      </div>
    </div>
  `.trim();
}

function setActiveListItem(idx) {
  const funclistPopup = document.getElementById("formula-list");
  for (const child of funclistPopup.children) {
    child.classList.remove("active");
  }
  funclistPopup.children[idx].classList.add("active");
}

function setActiveParamIdx(paramIdx) {
  const funcdetailPopup = document.getElementById("formula-help-popup");
  const activeItems = funcdetailPopup.querySelectorAll(".active");
  activeItems.forEach(item => item.classList.remove("active"));

  const helpParams = funcdetailPopup.querySelectorAll(".formula-help-popup-header-holder .formula-arguments-help-parameter");
  const exampleParams = funcdetailPopup.querySelectorAll(".formula-help-popup-example-holder .formula-arguments-help-parameter");
  const paramDescItems = funcdetailPopup.querySelectorAll(".formula-help-popup-parameter .formula-help-popup-parameter-section");

  if (paramIdx < helpParams.length) {
    helpParams.item(paramIdx).classList.add("active");
    exampleParams.item(paramIdx).classList.add("active");
    paramDescItems.item(paramIdx).classList.add("active");
    paramDescItems.item(paramIdx).children[0].classList.add("active");
  }
}

window.onload = () => {
  hideFuncPopup();

  document.getElementById("cell-editor").onkeyup = (evt) => {
    const text = evt.target.value;
    const lastChar = text == '' ? '' : text.charAt(text.length - 1);
    let formula = new Formula(evt.target.value);

    const state = formula.getState();
    console.log(state);
    switch (state) {
      case 0:
        // hide function popup
        // parser.parse(evt.target.value);
        hideFuncPopup();
        break;
      case 'within-nr':
        // do nothing
        break;
      case 'within-func':
      case 'within-func-parentheses': {
        // TODO
        // 1. get last function formula
        // 2. get the function name of last formula
        // 3. filter the function list by function name
        // 4. show list popup

        let viewMode = 'none'; // 'funclist' || 'detailview' || 'none';
        let paramIdx = 0;
        // 1. get last formula
        const currentFormula = formula.getLastFunctionEvaluator();
        // 2. get function name
        const funcName = currentFormula.getFunctionName();
        // 3. detect funclist or detail view
        paramIdx = currentFormula.getFunctionParams().length;
        if (paramIdx > 0) {
          viewMode = 'detailview';
          if (lastChar !== ',') {
            paramIdx = paramIdx - 1;
          }
        }
        else {
          if (lastChar === '(') {
            viewMode = 'detailview';
          }
          else {
            viewMode = 'funclist';
          }
        }
        hideFuncPopup();
        if (viewMode === 'funclist') {
          // 3. filter the function list
          const funcList = filterFuncListByName(funcName);
          if (funcList.length > 0) {
            // show context
            showFuncListPopup(funcList);
            setActiveListItem(0);
          }
        }
        else if (viewMode === 'detailview') {
          const funcData = getFuncData(funcName);
          if (funcData) {
            showFuncDetailPopup(funcData);
            setActiveParamIdx(paramIdx);
          }
        }
      } break;
      case 'within-named-var':
        // do nothing
        break;
      case 'within-parentheses':
        // do nothing
        break;
      default:
        break;
    }
  }
}