export class FormulaPopup {
  constructor(_perspective_el) {
    this._perspective_el = _perspective_el;
    this._formula_list = this._perspective_el;
    this._formula_detail = this._perspective_el;
  }

  filterFuncListByName(name) {
    return FuncList.filter(func => func.name.toLowerCase().startsWith(name.toLowerCase()));
  }
  
  getFuncData(name) {
    return FuncList.find(func => func.name.toLowerCase() == name.toLowerCase());
  }
  

  /**
   * 
   * funclist param structure
   *  [
       {
          name: "CONCAT",
          desc: "Appends strings to one another.",
          about: "Returns the concatenation of two values.",
          params: [
            {
              name: "value1",
              desc: "The value to which value2 will be appended",
            },
            {
              name: "value2",
              desc: "The value to append to value1"
            }
          ],
          example: {
            params: [
              "\"hello\"",
              "\"goodbye\""
            ]
          },
        },
      ]
   */
  showFuncListPopup(funclist) {
    const funclistPopup = this._formula_list;
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
  
  hideFuncPopup() {
    const funclistPopup = this._formula_list;
    funclistPopup.style.display = "none";
    const funcdetailPopup = this._formula_detail;
    funcdetailPopup.style.display = "none";
  }
  
  /**
   * 
   * funcData structure
   * {
        name: "CONCAT",
        desc: "Appends strings to one another.",
        about: "Returns the concatenation of two values.",
        params: [
          {
            name: "value1",
            desc: "The value to which value2 will be appended",
          },
          {
            name: "value2",
            desc: "The value to append to value1"
          }
        ],
        example: {
          params: [
            "\"hello\"",
            "\"goodbye\""
          ]
        },
      },
   */
  showFuncDetailPopup(funcData) {
    const funcdetailPopup = this._formula_detail;
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
  
  setActiveListItem(idx) {
    const funclistPopup = this._formula_list;
    for (const child of funclistPopup.children) {
      child.classList.remove("active");
    }
    funclistPopup.children[idx].classList.add("active");
  }
  
  setActiveParamIdx(paramIdx) {
    const funcdetailPopup = this._formula_detail;
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
}
