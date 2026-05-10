// ============================================
// APPS SCRIPT - CATÁLOGO DE LIVROS
// Cole este código no editor do Google Apps Script
// (script.google.com) e reimplante o Web App.
//
// Substitua SPREADSHEET_ID pelo ID da sua planilha:
// (é a parte longa da URL entre /d/ e /edit)
// ============================================

const SPREADSHEET_ID = "1ZfLN5R_gwIeyVcpy6O5Fkg8vzrqryZjb2jiJxjd7AgM";

// Roles válidos para validação server-side
const ROLES_VALIDOS = ["Admin", "Editor", "Visualizador"];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var userEmail = body.userEmail || "anonimo";
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (action === "addBook") {
      var sheet = ss.getSheets()[0];
      sheet.appendRow([
        body.id,
        body.titulo,
        body.autor,
        body.editora,
        body.categoria,
        body.exemplares,
        body.resumo,
        body.foto,
      ]);
      registrarAuditoria(ss, userEmail, "addBook", "Livro: " + body.titulo + " (ID: " + body.id + ")");
      return jsonResponse({ status: "success" });
    }

    if (action === "deleteBook") {
      var sheet = ss.getSheets()[0];
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(body.id)) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      registrarAuditoria(ss, userEmail, "deleteBook", "ID: " + body.id);
      return jsonResponse({ status: "success" });
    }

    if (action === "addCategory") {
      var configSheet = ss.getSheetByName("Configuracao");
      if (configSheet) {
        configSheet.appendRow([body.categoria]);
        registrarAuditoria(ss, userEmail, "addCategory", "Categoria: " + body.categoria);
      }
      return jsonResponse({ status: "success" });
    }

    if (action === "deleteCategory") {
      var configSheet = ss.getSheetByName("Configuracao");
      if (configSheet) {
        var catData = configSheet.getDataRange().getValues();
        for (var i = 1; i < catData.length; i++) {
          if (catData[i][0] === body.categoria) {
            configSheet.deleteRow(i + 1);
            break;
          }
        }
        registrarAuditoria(ss, userEmail, "deleteCategory", "Categoria: " + body.categoria);
      }
      return jsonResponse({ status: "success" });
    }

    return jsonResponse({ error: "Ação desconhecida: " + action });

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// Opcional: endpoint GET para consultar role via fetch com mode:'cors'
// Útil se quiser mover a verificação de role para o servidor no futuro.
function doGet(e) {
  var action = e.parameter.action;

  if (action === "getRole") {
    var email = e.parameter.email || "";
    var role = getRoleParaEmail(email);
    return jsonResponse({ role: role, email: email });
  }

  return jsonResponse({ status: "ok" });
}

function getRoleParaEmail(email) {
  if (!email) return "Visualizador";

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Usuarios");
    if (!sheet) return "Visualizador";

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === email.toLowerCase()) {
        var role = String(data[i][1]);
        if (ROLES_VALIDOS.indexOf(role) !== -1) return role;
      }
    }
  } catch (err) {
    Logger.log("Erro ao buscar role: " + err.toString());
  }

  return "Visualizador";
}

function registrarAuditoria(ss, email, acao, detalhes) {
  try {
    var sheet = ss.getSheetByName("AuditLog");
    if (!sheet) {
      sheet = ss.insertSheet("AuditLog");
      sheet.appendRow(["Data/Hora", "Email", "Ação", "Detalhes"]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
    }

    var timestamp = Utilities.formatDate(
      new Date(),
      "America/Sao_Paulo",
      "dd/MM/yyyy HH:mm:ss"
    );

    sheet.appendRow([timestamp, email, acao, detalhes]);
  } catch (err) {
    Logger.log("Erro ao registrar auditoria: " + err.toString());
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
