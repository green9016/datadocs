import perspective from "@jpmorganchase/perspective";
const PLACEMENTS = ["auto", "left", "right", "top", "bottom"];
export class Tooltip {
    constructor(viewer, options = {}){

        this._type = options.type || "WARNING";
        this._viewer = viewer;
        this._title = options.title || "";
        this._data = options.data || "";

        this._psp_tooltip = this._viewer._psp_tooltip;

        this._bounds = this._viewer.shadowRoot && this._viewer.shadowRoot.host ? this._viewer.shadowRoot.host.getBoundingClientRect(): {};

        this._placement = options.placement && PLACEMENTS.includes(options.placement) ? options.placement: "auto";

        this._interactive_border = 10;

        this._offset = {top: 5, bottom: 5, left: 5, right: 5};

        this._reference = null;

        this._union_rect = {};
    }

    open(event){
      if (!event){
        return;
      }

      event.preventDefault();

      if (!this._psp_tooltip){
        return;
      }

      this._psp_tooltip.style.visibility = "hidden";

      this._tooltip_container = document.createElement("div");
      this._tooltip_container.setAttribute("id", "psp_tooltip_container");
      this._tooltip_container.setAttribute("class", "tooltip-container");

      // Header
      this._tooltip_header = document.createElement("div");
      this._tooltip_header.setAttribute("class", "tooltip-header");

      this._psp_tooltip_title = document.createElement("div");
      this._psp_tooltip_title.setAttribute("id", "psp_tooltip_title");
      this._psp_tooltip_title.setAttribute("class", "tooltip-title");

      this._psp_tooltip_title.innerHTML = this._title;
      this._tooltip_header.appendChild(this._psp_tooltip_title);

      // Data
      this._tooltip_content = document.createElement("div");
      this._tooltip_content.setAttribute("class", "tooltip-content");

      this._psp_tooltip_data = document.createElement("div");
      this._psp_tooltip_data.setAttribute("id", "psp_tooltip_data");
      this._psp_tooltip_data.setAttribute("class", "tooltip-data");

      this._psp_tooltip_data.innerHTML = this._data;
      this._tooltip_content.appendChild(this._psp_tooltip_data);

      this._tooltip_container.appendChild(this._tooltip_header);
      this._tooltip_container.appendChild(this._tooltip_content);

      this._psp_tooltip.innerHTML = "";
      this._psp_tooltip.appendChild(this._tooltip_container);
      this._psp_tooltip.classList.remove("hidden");

      const w = this._psp_tooltip.offsetWidth;
      let h = this._psp_tooltip.offsetHeight;

      var client_x = event.clientX;
      var w_view = window.innerWidth;

      var client_y = event.clientY;
      var h_view = window.innerHeight;
      var left;
      var top;

      const tooltip_bounds = this._psp_tooltip.getBoundingClientRect();
      const reference_bounds = this._reference.getBoundingClientRect();
      if (!this._placement || this._placement === "auto"){// Tooltip's possitions will be calculation based on the move cursor

        left = client_x + 20;
        top = client_y - Math.floor(h/2) + this._bounds.y;

        // Left
        if (w_view - client_x < w){
            if (client_x - w <= 0){
              left = 0;
            }else{
              left = client_x - w - 20;
            }
        }

        if (this._bounds && this._bounds.left && this._bounds.left > 0){
          left = left - this._bounds.left;
        }

        // Top
        if (h_view - client_y < Math.floor(h/2)){
            top = h_view - h - 5;
        }

        if (this._bounds && this._bounds.top && this._bounds.top > 0){
          top = top - this._bounds.top;
        }
      }else{
        // Tooltip's possitions will be calculated based on reference element
        const center_x = reference_bounds.left + ((reference_bounds.right - reference_bounds.left) / 2);
        const center_y = reference_bounds.top + ((reference_bounds.bottom - reference_bounds.top) / 2);

        if (this._placement === "right"){
          left = reference_bounds.right + this._offset.right;
          top = center_y - Math.floor(h/2);
        }else if(this._placement === "left"){
          left = reference_bounds.left - this._offset.left - w;
          top = center_y - Math.floor(h/2);
        }else if(this._placement === "top"){
          left = center_x - w/2;
          top = reference_bounds.top - this._offset.top - h;
        }else if(this._placement === "bottom"){
          left = center_x - w/2;
          top = reference_bounds.bottom + this._offset.top;
        }
      }

      this._psp_tooltip.style.top = top + "px";
      this._psp_tooltip.style.bottom = "unset";
      this._psp_tooltip.style.left = left + "px";
      this._psp_tooltip.style.right = "unset";

      this._psp_tooltip.style.visibility = "visible";

      this.did_union_rect();
    }

    close(){
      if (this._psp_tooltip){
        this._psp_tooltip.style.visibility = "hidden";
        this._psp_tooltip.classList.add("hidden");
      }
    }

    is_open(reference){
      if(this._psp_tooltip && this._reference === reference
        && !this._psp_tooltip.classList.contains("hidden") && this._psp_tooltip.style.visibility !== "hidden"){
        return true;
      }
      return false;
    }

    add_title(title){
      this._title = title;
    }

    add_data(data){
      this._data = data;
    }

    add_reference(reference){
      this._reference = reference;
    }

    get_reference(reference){
      return this._reference = reference;
    }

    add_placement(placement){
      this._placement = placement && PLACEMENTS.includes(placement) ? placement: "auto";
    }

    is_cursor_outside_interactive_border(event) {
      const client_x = event.clientX;
      const client_y = event.clientY;

      const tooltip_bounds = this._psp_tooltip.getBoundingClientRect() || {};
      //const offset = this._bounds;
      let top_distance = this._placement === 'bottom' ? this._offset.top : 0;
      let bottom_distance = this._placement === 'top' ? this._offset.bottom : 0;
      let left_distance = this._placement === 'right' ? this._offset.left : 0;
      let right_distance = this._placement === 'left' ? this._offset.right : 0;

      let exceeds_top = tooltip_bounds.top - client_y + top_distance > this._interactive_border;
      let exceeds_bottom = client_y - tooltip_bounds.bottom - bottom_distance > this._interactive_border;
      let exceeds_left = tooltip_bounds.left - client_x + left_distance > this._interactive_border;
      let exceeds_right = client_x - tooltip_bounds.right - right_distance > this._interactive_border;

      return exceeds_top || exceeds_bottom || exceeds_left || exceeds_right;
    }

    is_cursor_inside_tooltip(event){
      var target = event.target;
      if (!target || !this._psp_tooltip){
        return false;
      }
      return this._psp_tooltip.contains(target);
    }

    is_cursor_inside_reference(event){
      let target = event.target;
      if (!target || !this._reference){
        return false;
      }
      return this._reference.contains(target);
    }

    is_cursor_between_reference_and_popper(event){
      if (this._psp_tooltip && this._reference){
        const client_x = event.clientX;
        const client_y = event.clientY;
        const tooltip_bounds = this._psp_tooltip.getBoundingClientRect();
        const reference_bounds = this._reference.getBoundingClientRect();
        /*
        let box_rect = {};
        if (tooltip_bounds.bottom > reference_bounds.top){
          box_rect.top = tooltip_bounds.bottom;
          box_rect.bottom = reference_bounds.top;
        }

        if (reference_bounds.bottom > tooltip_bounds.top){
          box_rect.top = reference_bounds.bottom;
          box_rect.bottom = tooltip_bounds.top;
        }

        if (tooltip_bounds.right < reference_bounds.left){
          box_rect.left = tooltip_bounds.right;
          box_rect.right = reference_bounds.left;
        }

        if (reference_bounds.right < tooltip_bounds.left){
          box_rect.left = reference_bounds.right;
          box_rect.right = tooltip_bounds.left;
        }
        */
        if (this._union_rect && this._union_rect.top !== undefined && this._union_rect.bottom !== undefined
          && this._union_rect.left !== undefined && this._union_rect.right !== undefined){
          if (this._union_rect.left <= client_x && client_x <= this._union_rect.right
            && this._union_rect.top <= client_y && client_y <= this._union_rect.bottom ){
            return true;
          }
        }
      }

      return false;
    }

    did_union_rect(){
      if (this._psp_tooltip && this._reference){
        const tooltip_bounds = this._psp_tooltip.getBoundingClientRect();
        const reference_bounds = this._reference.getBoundingClientRect();

        this._union_rect = {}
        if (!this._placement || this._placement === "auto"){
          if (tooltip_bounds.bottom > reference_bounds.top){
            this._union_rect.top = tooltip_bounds.bottom;
            this._union_rect.bottom = reference_bounds.top;
          }else if (reference_bounds.bottom > tooltip_bounds.top){
            this._union_rect.top = reference_bounds.bottom;
            this._union_rect.bottom = tooltip_bounds.top;
          }

          if (tooltip_bounds.right < reference_bounds.left){
            this._union_rect.left = tooltip_bounds.right;
            this._union_rect.right = reference_bounds.left;
          } else if (reference_bounds.right < tooltip_bounds.left){
            this._union_rect.left = reference_bounds.right;
            this._union_rect.right = tooltip_bounds.left;
          }
        }else{
          if (this._placement === "top"){
            this._union_rect.top = tooltip_bounds.bottom;
            this._union_rect.bottom = reference_bounds.top;
            this._union_rect.left = reference_bounds.width > tooltip_bounds.width ? tooltip_bounds.left : reference_bounds.left;
            this._union_rect.right = reference_bounds.width > tooltip_bounds.width ? tooltip_bounds.right : reference_bounds.right;
          }else if (this._placement === "bottom"){
            this._union_rect.top = reference_bounds.bottom;
            this._union_rect.bottom = tooltip_bounds.top;
            this._union_rect.left = reference_bounds.width > tooltip_bounds.width ? tooltip_bounds.left : reference_bounds.left;
            this._union_rect.right = reference_bounds.width > tooltip_bounds.width ? tooltip_bounds.right : reference_bounds.right;
          }else if (this._placement === "left"){
            this._union_rect.top = reference_bounds.height > tooltip_bounds.height ? tooltip_bounds.top: reference_bounds.top;
            this._union_rect.bottom = reference_bounds.height > tooltip_bounds.height ? tooltip_bounds.bottom: reference_bounds.bottom;
            this._union_rect.left = tooltip_bounds.right;
            this._union_rect.right = reference_bounds.left;
          }else if (this._placement === "right"){
            this._union_rect.top = reference_bounds.height > tooltip_bounds.height ? tooltip_bounds.top: reference_bounds.top;
            this._union_rect.bottom = reference_bounds.height > tooltip_bounds.height ? tooltip_bounds.bottom: reference_bounds.bottom;
            this._union_rect.left = reference_bounds.right;
            this._union_rect.right = tooltip_bounds.left;
          }
        }
      }
    }

    reorder_points() {
        const is_two_points_in_different_side = (points, C, D) => {
            function get_line_fomular(A, B) {
                // a line fomular is `ax + by + c = 0`
                var line = { a: null, b: null, c: null };
                line.a = B.y - A.y;
                line.b = -(B.x - A.x);
                line.c = -(line.a * A.x + line.b * A.y);

                return line;
            }
            var line = get_line_fomular(points[0], points[1]);
            var product_CD = (line.a * C.x + line.b * C.y + line.c) * (line.a * D.x + line.b * D.y + line.c);

            if (product_CD < 0) {
                return true;
            } else if (product_CD > 0) {
                return false;
            } else {
                return false;
            }
        }
        let arr_points = [p1, p2, p3, p4];
        arr_points = arr_points.sort((a, b) => a.x - b.x);

        let diagonal_line = [arr_points[0], arr_points[3]];
        if (this.is_two_points_in_different_side(diagonal_line, arr_points[1], arr_points[2])) {
            p1 = arr_points[0];
            p2 = arr_points[1];
            p3 = arr_points[3];
            p4 = arr_points[2];

        } else {
            p1 = arr_points[0];
            p2 = arr_points[1];
            p3 = arr_points[2];
            p4 = arr_points[3];
        }

    }

    is_inside_shape(event) {
        this.reorder_points();

        const triangle_area = (A, B, C) => {
            // compute ABC triangle area
            const line_distance = (M, N) => {
                return Math.sqrt((M.x - N.x) * (M.x - N.x) + (M.y - N.y) * (M.y - N.y));
            }
            const ab_distance = line_distance(A, B);
            const bc_distance = line_distance(B, C);
            const ac_distance = line_distance(A, C);
            const s = (ab_distance + bc_distance + ac_distance) / 2;

            return Math.sqrt(s * (s - ab_distance) * (s - bc_distance) * (s - ac_distance));
        }

        // client position
        let pc = { x: event.clientX, y: event.clientY };

        let quadrilateral_area = triangle_area(p1, p2, p4) + triangle_area(p2, p3, p4);

        let client_area = triangle_area(pc, p1, p2) + triangle_area(pc, p2, p3) + triangle_area(pc, p3, p4) + triangle_area(pc, p4, p1);

        // theta shows difference between client_area and quadrilateral_area
        // theta decide if client point
        let theta = Math.abs(client_area - quadrilateral_area);
        let theta_threshold = 50;
        if (theta <= theta_threshold) {
            return true;
        } else {
            return false;
        }
    }

}
