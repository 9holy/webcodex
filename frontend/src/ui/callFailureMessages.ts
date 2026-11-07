/** Shared Desktop/Web activity copy. Unknown text and locales use the caller's fallback. */
export const CALL_FAILURE_LANGUAGES = ["zh-CN", "zh-TW", "ja-JP", "ko-KR", "de-DE", "fr-FR"] as const;

type Translations = readonly [string, string, string, string, string, string];

export const CALL_FAILURE_MESSAGES: Readonly<Record<string, Translations>> = {
  "Call succeeded": ["调用成功", "呼叫成功", "呼び出しに成功しました", "호출 성공", "Aufruf erfolgreich", "Appel réussi"],
  "Call cancelled": ["调用已取消", "呼叫已取消", "呼び出しはキャンセルされました", "호출 취소됨", "Aufruf abgebrochen", "Appel annulé"],
  "Result not confirmed": ["结果尚未确认", "結果尚未確認", "結果は未確認です", "결과 미확인", "Ergebnis nicht bestätigt", "Résultat non confirmé"],
  "Request rejected": ["请求已被拒绝，未开始执行", "請求已被拒絕，尚未開始執行", "リクエストは拒否され、実行は開始されていません", "요청이 거부되어 실행이 시작되지 않음", "Anfrage abgelehnt, Ausführung nicht gestartet", "Requête refusée, exécution non démarrée"],
  "Execution failed": ["执行失败", "執行失敗", "実行に失敗しました", "실행 실패", "Ausführung fehlgeschlagen", "Échec de l’exécution"],
  "Call failed": ["调用失败", "呼叫失敗", "呼び出しに失敗しました", "호출 실패", "Aufruf fehlgeschlagen", "Échec de l’appel"],
  "The connection is missing a required WebCodex permission.": [
    "当前连接缺少此操作所需的 WebCodex 权限。",
    "目前連線缺少此操作所需的 WebCodex 權限。",
    "この接続には、操作に必要な WebCodex の権限がありません。",
    "현재 연결에 이 작업에 필요한 WebCodex 권한이 없습니다.",
    "Der Verbindung fehlt eine für diesen Vorgang erforderliche WebCodex-Berechtigung.",
    "Il manque à cette connexion une autorisation WebCodex requise pour cette opération."
  ],
  "Access was denied by an authorization or local execution policy.": [
    "此操作被授权规则或本机执行策略拒绝。",
    "此操作被授權規則或本機執行原則拒絕。",
    "権限の規則またはローカルの実行ポリシーによってアクセスが拒否されました。",
    "권한 규칙 또는 로컬 실행 정책에 의해 접근이 거부되었습니다.",
    "Eine Berechtigungsregel oder lokale Ausführungsrichtlinie hat den Zugriff verweigert.",
    "Une règle d’autorisation ou une politique d’exécution locale a refusé l’accès."
  ],
  "Check the task's permissions and the selected Runner's local access. Update the specific missing permission before retrying.": [
    "检查任务权限和所选 Runner 的本机访问权限，补充被拒绝的具体权限后再试。",
    "檢查任務權限與所選 Runner 的本機存取權限，補足遭拒的特定權限後再試。",
    "タスクの権限と、選択した Runner のローカルアクセス権を確認してください。不足している権限を個別に修正してから再試行してください。",
    "작업 권한과 선택한 Runner의 로컬 접근 권한을 확인하세요. 부족한 해당 권한을 수정한 뒤 다시 시도하세요.",
    "Prüfen Sie die Aufgabenberechtigungen und die lokalen Zugriffsrechte des gewählten Runners. Passen Sie gezielt die fehlende Berechtigung an, bevor Sie es erneut versuchen.",
    "Vérifiez les autorisations de la tâche et les droits d’accès locaux du Runner sélectionné. Corrigez précisément l’autorisation manquante avant de réessayer."
  ],
  "This operation requires its own review in Chat before it can run.": [
    "此操作需要在 Chat 中单独审核后才能执行。",
    "此操作需要在 Chat 中個別審核後才能執行。",
    "この操作を実行するには、Chat 内で個別の審査が必要です。",
    "이 작업을 실행하려면 Chat에서 별도의 검토가 필요합니다.",
    "Dieser Vorgang muss vor der Ausführung in Chat gesondert geprüft werden.",
    "Cette opération doit faire l’objet d’un examen distinct dans Chat avant de pouvoir être exécutée."
  ],
  "The task session does not permit this write or command.": [
    "当前任务会话不允许此写入操作或命令。",
    "目前的任務工作階段不允許此寫入操作或命令。",
    "このタスクセッションでは、この書き込みやコマンドは許可されていません。",
    "현재 작업 세션에서는 이 쓰기 작업 또는 명령이 허용되지 않습니다.",
    "Die Aufgabensitzung erlaubt diesen Schreibvorgang oder Befehl nicht.",
    "La session de tâche n’autorise pas cette écriture ou cette commande."
  ],
  "The task session is closed and cannot accept this operation.": [
    "任务会话已结束，无法接受此操作。",
    "任務工作階段已結束，無法接受此操作。",
    "タスクセッションは終了しているため、この操作を受け付けられません。",
    "작업 세션이 종료되어 이 작업을 받을 수 없습니다.",
    "Die Aufgabensitzung ist geschlossen und kann diesen Vorgang nicht annehmen.",
    "La session de tâche est fermée et ne peut pas accepter cette opération."
  ],
  "The requested task session is unavailable to this connection.": [
    "当前连接无法访问所请求的任务会话。",
    "目前連線無法存取所要求的任務工作階段。",
    "この接続からは、要求されたタスクセッションを利用できません。",
    "현재 연결에서는 요청한 작업 세션에 접근할 수 없습니다.",
    "Die angeforderte Aufgabensitzung ist für diese Verbindung nicht verfügbar.",
    "La session de tâche demandée n’est pas accessible depuis cette connexion."
  ],
  "The task session's retained history has expired.": [
    "任务会话的历史记录已过保留期限。",
    "任務工作階段的歷史記錄已超過保留期限。",
    "タスクセッションの履歴は保存期間を過ぎています。",
    "작업 세션 기록의 보관 기간이 만료되었습니다.",
    "Die Aufbewahrungsfrist für den Verlauf der Aufgabensitzung ist abgelaufen.",
    "La durée de conservation de l’historique de la session de tâche a expiré."
  ],
  "The task session belongs to a different project.": [
    "所选任务会话属于另一个项目。",
    "所選的任務工作階段屬於另一個專案。",
    "このタスクセッションは別のプロジェクトに属しています。",
    "선택한 작업 세션은 다른 프로젝트에 속합니다.",
    "Die Aufgabensitzung gehört zu einem anderen Projekt.",
    "La session de tâche appartient à un autre projet."
  ],
  "The task session could not be read from storage.": [
    "无法读取已保存的任务会话。",
    "無法讀取已儲存的任務工作階段。",
    "保存されたタスクセッションを読み取れませんでした。",
    "저장된 작업 세션을 읽을 수 없습니다.",
    "Die gespeicherte Aufgabensitzung konnte nicht gelesen werden.",
    "La session de tâche enregistrée n’a pas pu être lue."
  ],
  "The project could not be identified or accessed.": [
    "无法确定或访问所选项目。",
    "無法識別或存取所選專案。",
    "プロジェクトを特定できないか、アクセスできませんでした。",
    "프로젝트를 식별하거나 접근할 수 없습니다.",
    "Das Projekt konnte nicht ermittelt werden oder war nicht zugänglich.",
    "Le projet n’a pas pu être identifié ou n’était pas accessible."
  ],
  "The call's inputs do not satisfy this tool's requirements.": [
    "调用参数不符合此工具的要求。",
    "呼叫參數不符合此工具的要求。",
    "呼び出しの入力が、このツールの要件を満たしていません。",
    "호출 입력값이 이 도구의 요구 사항을 충족하지 않습니다.",
    "Die Eingaben des Aufrufs erfüllen die Anforderungen dieses Werkzeugs nicht.",
    "Les paramètres de l’appel ne satisfont pas aux exigences de cet outil."
  ],
  "The Runner was unavailable when this call needed it.": [
    "此次调用需要 Runner 时，Runner 不可用。",
    "此次呼叫需要 Runner 時，Runner 無法使用。",
    "この呼び出しで Runner が必要になった時点では、Runner を利用できませんでした。",
    "이 호출에 Runner가 필요한 시점에 Runner를 사용할 수 없었습니다.",
    "Der Runner war nicht verfügbar, als dieser Aufruf ihn benötigte.",
    "Le Runner était indisponible au moment où cet appel en avait besoin."
  ],
  "The approval request changed, expired, or was already handled.": [
    "审批请求已变化、过期或已被处理。",
    "核准請求已變更、到期或已處理。",
    "承認リクエストは変更されたか、有効期限が切れたか、すでに処理されています。",
    "승인 요청이 변경되었거나 만료되었거나 이미 처리되었습니다.",
    "Die Genehmigungsanfrage wurde geändert, ist abgelaufen oder wurde bereits bearbeitet.",
    "La demande d’approbation a changé, a expiré ou a déjà été traitée."
  ],
  "SSH authentication or the saved login credentials were unavailable.": [
    "SSH 身份验证失败，或已保存的登录凭据不可用。",
    "SSH 驗證失敗，或已儲存的登入憑據無法使用。",
    "SSH 認証、または保存されたログイン認証情報を利用できませんでした。",
    "SSH 인증 또는 저장된 로그인 자격 증명을 사용할 수 없었습니다.",
    "Die SSH-Authentifizierung oder die gespeicherten Anmeldedaten waren nicht verfügbar.",
    "L’authentification SSH ou les identifiants de connexion enregistrés étaient indisponibles."
  ],
  "The SSH server identity could not be confirmed with the saved trust.": [
    "无法根据已保存的信任信息确认 SSH 服务器身份。",
    "無法依據已儲存的信任資訊確認 SSH 伺服器身分。",
    "保存された信頼情報では、SSH サーバーの識別情報を確認できませんでした。",
    "저장된 신뢰 정보로 SSH 서버의 신원을 확인할 수 없습니다.",
    "Die Identität des SSH-Servers konnte anhand der gespeicherten Vertrauensdaten nicht bestätigt werden.",
    "L’identité du serveur SSH n’a pas pu être confirmée à partir des informations de confiance enregistrées."
  ],
  "The SSH connection or the Runner's local SSH client was unavailable.": [
    "SSH 连接或 Runner 本机的 SSH 客户端不可用。",
    "SSH 連線或 Runner 本機的 SSH 用戶端無法使用。",
    "SSH 接続、または Runner のローカル SSH クライアントを利用できませんでした。",
    "SSH 연결 또는 Runner의 로컬 SSH 클라이언트를 사용할 수 없었습니다.",
    "Die SSH-Verbindung oder der lokale SSH-Client des Runners war nicht verfügbar.",
    "La connexion SSH ou le client SSH local du Runner était indisponible."
  ],
  "The selected coding agent was unavailable or disabled.": [
    "所选编程代理不可用或未启用。",
    "所選的程式開發代理無法使用或尚未啟用。",
    "選択したコーディングエージェントを利用できないか、無効になっています。",
    "선택한 코딩 에이전트를 사용할 수 없거나 비활성화되어 있습니다.",
    "Der gewählte Coding-Agent war nicht verfügbar oder deaktiviert.",
    "L’agent de programmation sélectionné était indisponible ou désactivé."
  ],
  "The command reported an unsuccessful exit.": [
    "命令已返回失败的退出结果。",
    "命令已回報失敗的結束結果。",
    "コマンドが失敗を示す終了結果を返しました。",
    "명령이 실패 종료 결과를 반환했습니다.",
    "Der Befehl hat einen erfolglosen Abschluss gemeldet.",
    "La commande a renvoyé un résultat de sortie en échec."
  ],
  "The call reached a time limit.": [
    "此次调用已达到时间限制。",
    "此次呼叫已達到時間限制。",
    "この呼び出しは制限時間に達しました。",
    "이 호출이 제한 시간에 도달했습니다.",
    "Der Aufruf hat ein Zeitlimit erreicht.",
    "L’appel a atteint une limite de temps."
  ],
  "WebCodex could not confirm the operation's final result.": [
    "WebCodex 无法确认此操作的最终结果。",
    "WebCodex 無法確認此操作的最終結果。",
    "WebCodex は操作の最終結果を確認できませんでした。",
    "WebCodex가 작업의 최종 결과를 확인할 수 없습니다.",
    "WebCodex konnte das endgültige Ergebnis des Vorgangs nicht bestätigen.",
    "WebCodex n’a pas pu confirmer le résultat final de l’opération."
  ],
  "The source or observation changed before the operation could complete.": [
    "操作完成前，源文件或已观察到的状态发生了变化。",
    "操作完成前，來源檔案或已觀察到的狀態發生了變化。",
    "操作が完了する前に、元のファイルまたは観測された状態が変わりました。",
    "작업이 완료되기 전에 원본 파일 또는 관찰된 상태가 변경되었습니다.",
    "Die Quelldatei oder der beobachtete Zustand hat sich geändert, bevor der Vorgang abgeschlossen werden konnte.",
    "Le fichier source ou l’état observé a changé avant que l’opération puisse se terminer."
  ],
  "This activity record does not contain a specific, safely displayable failure reason.": [
    "这条活动记录没有保存可安全显示的具体失败原因。",
    "這筆活動記錄未保存可安全顯示的具體失敗原因。",
    "このアクティビティ記録には、安全に表示できる具体的な失敗理由がありません。",
    "이 활동 기록에는 안전하게 표시할 수 있는 구체적인 실패 원인이 없습니다.",
    "Dieser Aktivitätseintrag enthält keinen konkreten Fehlergrund, der sicher angezeigt werden kann.",
    "Cette entrée d’activité ne contient pas de raison d’échec précise pouvant être affichée en toute sécurité."
  ],
  "Refresh the linked job or task session before retrying. The operation may already have taken effect.": [
    "重试前先刷新关联作业或任务会话，操作可能已经生效。",
    "重試前請先重新整理關聯作業或任務工作階段；操作可能已經生效。",
    "再試行する前に、関連するジョブまたはタスクセッションを更新してください。操作はすでに反映されている可能性があります。",
    "다시 시도하기 전에 연결된 작업이나 작업 세션을 새로 고치세요. 작업이 이미 적용되었을 수 있습니다.",
    "Aktualisieren Sie vor einem erneuten Versuch den verknüpften Job oder die Aufgabensitzung. Der Vorgang könnte bereits wirksam geworden sein.",
    "Actualisez le job ou la session de tâche associé avant de réessayer. L’opération a peut-être déjà produit ses effets."
  ],
  "Refresh the linked job or task session before correcting the recorded problem. This record does not show whether the operation already took effect.": [
    "先刷新关联作业或任务会话，确认操作是否已生效，再处理已记录的问题；这条记录不能确定操作是否已经生效。",
    "請先重新整理關聯作業或任務工作階段，確認操作是否已生效，再處理已記錄的問題；這筆記錄無法確定操作是否已經生效。",
    "記録された問題を修正する前に、関連するジョブまたはタスクセッションを更新してください。この記録だけでは、操作がすでに反映されたかどうかは分かりません。",
    "기록된 문제를 수정하기 전에 연결된 작업이나 작업 세션을 새로 고치세요. 이 기록만으로는 작업이 이미 적용되었는지 알 수 없습니다.",
    "Aktualisieren Sie den verknüpften Job oder die Aufgabensitzung, bevor Sie das aufgezeichnete Problem beheben. Aus diesem Eintrag geht nicht hervor, ob der Vorgang bereits wirksam geworden ist.",
    "Actualisez le job ou la session de tâche associé avant de corriger le problème enregistré. Cette entrée ne permet pas de savoir si l’opération a déjà produit ses effets."
  ],
  "Review this Chat connection's permissions. If its credential or OAuth grant changes, reconnect or reauthorize Chat before trying again.": [
    "检查当前 Chat 连接的权限。若凭据或 OAuth 授权有变化，请在 Chat 中重新连接或授权后再试。",
    "檢查目前 Chat 連線的權限。若憑據或 OAuth 授權有變更，請在 Chat 中重新連線或授權後再試。",
    "この Chat 接続の権限を確認してください。認証情報や OAuth の許可が変更された場合は、Chat を再接続または再認可してから再試行してください。",
    "현재 Chat 연결의 권한을 확인하세요. 자격 증명이나 OAuth 권한이 변경되면 Chat을 다시 연결하거나 재승인한 뒤 다시 시도하세요.",
    "Prüfen Sie die Berechtigungen dieser Chat-Verbindung. Wenn sich ihre Zugangsdaten oder OAuth-Freigaben ändern, verbinden oder autorisieren Sie Chat erneut, bevor Sie es noch einmal versuchen.",
    "Vérifiez les autorisations de cette connexion Chat. Si ses identifiants ou son autorisation OAuth changent, reconnectez ou réautorisez Chat avant de réessayer."
  ],
  "Refresh the tools available in Chat and request the separately reviewed operation. Do not retry a refused action through another route.": [
    "刷新 Chat 中可用的工具，并请求单独审核此操作。已被拒绝的操作不能换一条调用路径重试。",
    "重新整理 Chat 中可用的工具，並請求個別審核此操作。已被拒絕的操作不可改用另一條呼叫路徑重試。",
    "Chat で利用できるツールを更新し、この操作を個別に審査するよう依頼してください。拒否された操作を別の経路で再試行しないでください。",
    "Chat에서 사용할 수 있는 도구를 새로 고치고 해당 작업의 별도 검토를 요청하세요. 거부된 작업을 다른 경로로 다시 시도하지 마세요.",
    "Aktualisieren Sie die verfügbaren Werkzeuge in Chat und fordern Sie den gesondert geprüften Vorgang an. Versuchen Sie eine abgelehnte Aktion nicht über einen anderen Weg erneut.",
    "Actualisez les outils disponibles dans Chat et demandez l’examen distinct de l’opération. Ne réessayez pas une action refusée par une autre voie."
  ],
  "For a write task, ask Chat to reopen the project in a writable task session using the authorized connection.": [
    "如果任务需要写入，请让 Chat 使用已授权的连接，重新以可写任务会话打开项目。",
    "若任務需要寫入，請讓 Chat 使用已授權的連線，以可寫入的任務工作階段重新開啟專案。",
    "書き込みが必要な場合は、認可済みの接続を使い、書き込み可能なタスクセッションでプロジェクトを開き直すよう Chat に依頼してください。",
    "쓰기 작업이 필요하면 승인된 연결을 사용해 쓰기 가능한 작업 세션으로 프로젝트를 다시 열도록 Chat에 요청하세요.",
    "Bitten Sie Chat bei einer Schreibaufgabe, das Projekt über die autorisierte Verbindung in einer beschreibbaren Aufgabensitzung erneut zu öffnen.",
    "Pour une tâche d’écriture, demandez à Chat de rouvrir le projet dans une session de tâche autorisant l’écriture, avec la connexion autorisée."
  ],
  "Open the project and start or select an available task session before continuing.": [
    "打开项目，开始或选择一个可用的任务会话后继续。",
    "開啟專案，啟動或選擇可用的任務工作階段後再繼續。",
    "プロジェクトを開き、利用可能なタスクセッションを開始または選択してから続行してください。",
    "프로젝트를 열고 사용 가능한 작업 세션을 시작하거나 선택한 뒤 계속하세요.",
    "Öffnen Sie das Projekt und starten oder wählen Sie eine verfügbare Aufgabensitzung, bevor Sie fortfahren.",
    "Ouvrez le projet, puis démarrez ou sélectionnez une session de tâche disponible avant de continuer."
  ],
  "Select the intended project and its task session, then ask Chat to use those current identities.": [
    "选择正确的项目及其任务会话，并让 Chat 使用当前选择继续。",
    "選擇正確的專案及其任務工作階段，並讓 Chat 使用目前的選擇繼續。",
    "対象のプロジェクトとタスクセッションを選び、現在選択しているそれらの識別情報を使うよう Chat に依頼してください。",
    "원하는 프로젝트와 작업 세션을 선택한 뒤 Chat이 현재 선택한 항목의 식별 정보를 사용하도록 요청하세요.",
    "Wählen Sie das gewünschte Projekt und seine Aufgabensitzung aus. Bitten Sie Chat, deren aktuelle Kennungen zu verwenden.",
    "Sélectionnez le projet souhaité et sa session de tâche, puis demandez à Chat d’utiliser leurs identifiants actuels."
  ],
  "Ask Chat to correct the tool inputs using the current tool definition, then try the corrected call.": [
    "让 Chat 根据当前工具说明修正调用参数，再发送修正后的调用。",
    "請讓 Chat 依據目前的工具定義修正呼叫參數，再送出修正後的呼叫。",
    "現在のツール定義に従って入力を修正するよう Chat に依頼し、修正後の呼び出しを試してください。",
    "현재 도구 정의에 맞게 입력값을 수정하도록 Chat에 요청한 뒤 수정된 호출을 시도하세요.",
    "Bitten Sie Chat, die Eingaben anhand der aktuellen Werkzeugdefinition zu korrigieren, und versuchen Sie dann den korrigierten Aufruf.",
    "Demandez à Chat de corriger les paramètres selon la définition actuelle de l’outil, puis essayez l’appel corrigé."
  ],
  "Check the Runner connection, then refresh the linked job or task session before deciding whether to retry.": [
    "检查 Runner 连接，再刷新关联作业或任务会话，确认状态后决定是否重试。",
    "檢查 Runner 連線，再重新整理關聯作業或任務工作階段，確認狀態後決定是否重試。",
    "Runner の接続を確認し、関連するジョブまたはタスクセッションを更新してから、再試行すべきか判断してください。",
    "Runner 연결을 확인한 다음 연결된 작업이나 작업 세션을 새로 고친 뒤 재시도 여부를 결정하세요.",
    "Prüfen Sie die Runner-Verbindung und aktualisieren Sie dann den verknüpften Job oder die Aufgabensitzung, bevor Sie über einen erneuten Versuch entscheiden.",
    "Vérifiez la connexion du Runner, puis actualisez le job ou la session de tâche associé avant de décider s’il faut réessayer."
  ],
  "Refresh Coding agents to see the current approval request. A previous decision is not replayed.": [
    "刷新“编程代理”面板，查看当前审批请求。此前的决定不会自动再次提交。",
    "重新整理「程式開發代理」面板，查看目前的核准請求。先前的決定不會自動再次提交。",
    "「コーディングエージェント」を更新して、現在の承認リクエストを確認してください。以前の判断が自動的に再送信されることはありません。",
    "‘코딩 에이전트’를 새로 고쳐 현재 승인 요청을 확인하세요. 이전 결정은 자동으로 다시 제출되지 않습니다.",
    "Aktualisieren Sie „Coding-Agenten“, um die aktuelle Genehmigungsanfrage zu sehen. Eine frühere Entscheidung wird nicht erneut übermittelt.",
    "Actualisez « Agents de programmation » pour voir la demande d’approbation actuelle. Une décision précédente n’est pas soumise à nouveau."
  ],
  "Open Extensions > SSH resources, check the login method, and test the connection again.": [
    "打开“扩展 > SSH 资源”，检查登录方式并重新测试连接。",
    "開啟「擴充功能 > SSH 資源」，檢查登入方式並重新測試連線。",
    "「拡張機能 > SSH リソース」を開き、ログイン方法を確認して、接続をもう一度テストしてください。",
    "‘확장 기능 > SSH 리소스’를 열어 로그인 방식을 확인하고 연결을 다시 테스트하세요.",
    "Öffnen Sie „Erweiterungen > SSH-Ressourcen“, prüfen Sie die Anmeldemethode und testen Sie die Verbindung erneut.",
    "Ouvrez « Extensions > Ressources SSH », vérifiez la méthode de connexion et testez à nouveau la connexion."
  ],
  "Open Extensions > SSH resources and verify the server fingerprint before confirming any changed identity.": [
    "打开“扩展 > SSH 资源”，核实服务器指纹后再确认变化后的身份。",
    "開啟「擴充功能 > SSH 資源」，核實伺服器指紋後再確認變更後的身分。",
    "「拡張機能 > SSH リソース」を開き、サーバーのフィンガープリントを検証してから、変更された識別情報を確認してください。",
    "‘확장 기능 > SSH 리소스’를 열고 서버 지문을 검증한 뒤 변경된 신원을 승인하세요.",
    "Öffnen Sie „Erweiterungen > SSH-Ressourcen“ und prüfen Sie den Fingerabdruck des Servers, bevor Sie eine geänderte Identität bestätigen.",
    "Ouvrez « Extensions > Ressources SSH » et vérifiez l’empreinte du serveur avant de confirmer tout changement d’identité."
  ],
  "Check the SSH connection and the Runner computer's SSH client permissions, then test the connection in Extensions > SSH resources.": [
    "检查 SSH 连接和 Runner 本机 SSH 客户端的权限，然后在“扩展 > SSH 资源”中测试连接。",
    "檢查 SSH 連線與 Runner 本機 SSH 用戶端的權限，再於「擴充功能 > SSH 資源」中測試連線。",
    "SSH 接続と Runner のコンピューター上の SSH クライアント権限を確認し、「拡張機能 > SSH リソース」で接続をテストしてください。",
    "SSH 연결과 Runner 컴퓨터의 SSH 클라이언트 권한을 확인한 뒤 ‘확장 기능 > SSH 리소스’에서 연결을 테스트하세요.",
    "Prüfen Sie die SSH-Verbindung und die Berechtigungen des SSH-Clients auf dem Runner-Rechner. Testen Sie die Verbindung anschließend unter „Erweiterungen > SSH-Ressourcen“.",
    "Vérifiez la connexion SSH et les autorisations du client SSH sur l’ordinateur du Runner, puis testez la connexion dans « Extensions > Ressources SSH »."
  ],
  "Open Extensions > Coding agents and check that the provider is configured, signed in, enabled, and loaded.": [
    "打开“扩展 > 编程代理”，检查代理是否已配置、登录、启用并由 Runner 加载。",
    "開啟「擴充功能 > 程式開發代理」，檢查代理是否已設定、登入、啟用並由 Runner 載入。",
    "「拡張機能 > コーディングエージェント」を開き、プロバイダーが設定済み、ログイン済み、有効かつ Runner に読み込まれていることを確認してください。",
    "‘확장 기능 > 코딩 에이전트’를 열어 제공자가 설정 및 로그인되었고 활성화되어 Runner에 로드되었는지 확인하세요.",
    "Öffnen Sie „Erweiterungen > Coding-Agenten“ und prüfen Sie, ob der Anbieter konfiguriert, angemeldet, aktiviert und vom Runner geladen ist.",
    "Ouvrez « Extensions > Agents de programmation » et vérifiez que le fournisseur est configuré, connecté, activé et chargé par le Runner."
  ],
  "Open the linked job or task session to inspect the command result and correct the reported problem before retrying.": [
    "打开关联作业或任务会话，查看命令结果，修正已报告的问题后再试。",
    "開啟關聯作業或任務工作階段，查看命令結果，修正已回報的問題後再試。",
    "関連するジョブまたはタスクセッションを開いてコマンドの結果を確認し、報告された問題を修正してから再試行してください。",
    "연결된 작업이나 작업 세션을 열어 명령 결과를 확인하고 보고된 문제를 수정한 뒤 다시 시도하세요.",
    "Öffnen Sie den verknüpften Job oder die Aufgabensitzung, prüfen Sie das Befehlsergebnis und beheben Sie das gemeldete Problem, bevor Sie es erneut versuchen.",
    "Ouvrez le job ou la session de tâche associé pour examiner le résultat de la commande et corriger le problème signalé avant de réessayer."
  ],
  "Refresh the file or task state and prepare the operation again against that current state.": [
    "刷新文件或任务状态，再根据最新状态重新准备操作。",
    "重新整理檔案或任務狀態，再依據最新狀態重新準備操作。",
    "ファイルまたはタスクの状態を更新し、その最新状態に基づいて操作を準備し直してください。",
    "파일이나 작업 상태를 새로 고친 뒤 최신 상태를 기준으로 작업을 다시 준비하세요.",
    "Aktualisieren Sie den Datei- oder Aufgabenstatus und bereiten Sie den Vorgang auf Grundlage dieses aktuellen Zustands erneut vor.",
    "Actualisez l’état du fichier ou de la tâche, puis préparez de nouveau l’opération à partir de cet état actuel."
  ],
  "Refresh the linked job or task session and inspect call diagnostics if available. Do not assume the operation is safe to repeat.": [
    "刷新关联作业或任务会话；如有调用诊断，请一并查看。请先确认操作是否已生效，再决定是否重试。",
    "重新整理關聯作業或任務工作階段；若有呼叫診斷，請一併查看。請先確認操作是否已生效，再決定是否重試。",
    "関連するジョブまたはタスクセッションを更新し、利用できる場合は呼び出しの診断情報も確認してください。操作を安全に繰り返せるとは限りません。",
    "연결된 작업이나 작업 세션을 새로 고치고 호출 진단 정보가 있으면 확인하세요. 같은 작업을 안전하게 반복할 수 있다고 가정하지 마세요.",
    "Aktualisieren Sie den verknüpften Job oder die Aufgabensitzung und prüfen Sie verfügbare Aufrufdiagnosen. Gehen Sie nicht davon aus, dass sich der Vorgang gefahrlos wiederholen lässt.",
    "Actualisez le job ou la session de tâche associé et consultez les diagnostics de l’appel, s’ils sont disponibles. Ne supposez pas qu’il est sans risque de répéter l’opération."
  ],
  "{count} s": ["{count} 秒", "{count} 秒", "{count} 秒", "{count}초", "{count} s", "{count} s"],
  "{count} min": ["{count} 分钟", "{count} 分鐘", "{count} 分", "{count}분", "{count} min", "{count} min"],
  "{hours} h {minutes} min": ["{hours} 小时 {minutes} 分钟", "{hours} 小時 {minutes} 分鐘", "{hours} 時間 {minutes} 分", "{hours}시간 {minutes}분", "{hours} Std. {minutes} Min.", "{hours} h {minutes} min"],
  "Why this call failed": ["失败原因", "失敗原因", "呼び出しが失敗した理由", "호출 실패 원인", "Grund für den fehlgeschlagenen Aufruf", "Pourquoi cet appel a échoué"],
  "The call returned an error; this record does not establish whether execution started.": [
    "调用返回了错误，但这条记录不能证明操作是否已经开始执行。",
    "呼叫回傳了錯誤，但這筆記錄無法證明操作是否已開始執行。",
    "呼び出しはエラーを返しましたが、この記録だけでは実行が開始されたかどうかは判断できません。",
    "호출이 오류를 반환했지만 이 기록만으로는 실행이 시작되었는지 확인할 수 없습니다.",
    "Der Aufruf hat einen Fehler zurückgegeben. Aus diesem Eintrag lässt sich nicht ableiten, ob die Ausführung begonnen hat.",
    "L’appel a renvoyé une erreur ; cette entrée ne permet pas de déterminer si l’exécution a commencé."
  ],
  "What to do next": ["下一步", "下一步", "次の対応", "다음 단계", "Nächste Schritte", "Étape suivante"],
  "This is the task closeout call. Its failure does not establish that a deployment or background process failed.": [
    "这是任务收尾调用。收尾失败不代表部署或后台进程执行失败。",
    "這是任務收尾呼叫。收尾失敗不代表部署或背景程序執行失敗。",
    "これはタスクを締めくくる呼び出しです。その失敗は、デプロイやバックグラウンドプロセスが失敗したことを意味するものではありません。",
    "이 호출은 작업을 마무리하는 호출입니다. 이 호출이 실패했다고 해서 배포나 백그라운드 프로세스가 실패한 것은 아닙니다.",
    "Dies ist der Aufruf zum Aufgabenabschluss. Sein Fehlschlagen belegt nicht, dass eine Bereitstellung oder ein Hintergrundprozess fehlgeschlagen ist.",
    "Il s’agit de l’appel de clôture de la tâche. Son échec ne permet pas de conclure qu’un déploiement ou un processus en arrière-plan a échoué."
  ],
  "Error category": ["错误分类", "錯誤分類", "エラー分類", "오류 분류", "Fehlerkategorie", "Catégorie d’erreur"],
  "Failure category": ["失败分类", "失敗分類", "失敗分類", "실패 분류", "Fehlschlagskategorie", "Catégorie d’échec"],
  "Recorded execution state": ["已记录的执行状态", "已記錄的執行狀態", "記録された実行状態", "기록된 실행 상태", "Aufgezeichneter Ausführungsstatus", "État d’exécution enregistré"],
  "Recorded recovery guidance": ["已记录的恢复建议", "已記錄的復原建議", "記録された復旧の案内", "기록된 복구 안내", "Aufgezeichnete Wiederherstellungshinweise", "Consignes de reprise enregistrées"],
  "Time since recorded call": ["距此次调用", "距此次呼叫", "記録された呼び出しからの経過時間", "기록된 호출 이후 경과 시간", "Zeit seit dem aufgezeichneten Aufruf", "Temps écoulé depuis l’appel enregistré"],
  "Time since response": ["距此次返回", "距此次回應", "応答からの経過時間", "응답 이후 경과 시간", "Zeit seit der Antwort", "Temps écoulé depuis la réponse"],
  "WebCodex returned this call. No later tool call is visible in the observed history.": [
    "WebCodex 已返回此次调用，在当前可见历史中尚未观察到后续工具调用。",
    "WebCodex 已回應此次呼叫，目前可見的歷史中尚未觀察到後續工具呼叫。",
    "WebCodex はこの呼び出しへの応答を返しました。確認できる履歴には、それ以降のツール呼び出しは見当たりません。",
    "WebCodex가 이 호출에 응답했습니다. 확인된 기록에는 이후의 도구 호출이 보이지 않습니다.",
    "WebCodex hat diesen Aufruf beantwortet. Im eingesehenen Verlauf ist kein späterer Werkzeugaufruf sichtbar.",
    "WebCodex a répondu à cet appel. Aucun appel d’outil ultérieur n’est visible dans l’historique observé."
  ],
  "Only part of the retained activity is shown.": [
    "当前仅显示部分保留的活动记录。",
    "目前僅顯示部分保留的活動記錄。",
    "保存されたアクティビティの一部のみを表示しています。",
    "보관된 활동 기록의 일부만 표시됩니다.",
    "Es wird nur ein Teil der aufbewahrten Aktivitäten angezeigt.",
    "Seule une partie des activités conservées est affichée."
  ],
  "Technical details": ["技术详情", "技術詳細資訊", "技術的な詳細", "기술 세부정보", "Technische Details", "Détails techniques"],
  "Server processing time": ["Server 处理耗时", "Server 處理耗時", "Server の処理時間", "Server 처리 시간", "Verarbeitungszeit des Servers", "Durée de traitement du serveur"],
  "Less than 1 ms": ["不足 1 毫秒", "不到 1 毫秒", "1 ミリ秒未満", "1밀리초 미만", "Weniger als 1 ms", "Moins de 1 ms"],
  "Gap to next recorded call": ["距后续已记录调用", "距後續已記錄呼叫", "次に記録された呼び出しまでの間隔", "다음에 기록된 호출까지의 간격", "Abstand zum nächsten aufgezeichneten Aufruf", "Intervalle jusqu’au prochain appel enregistré"],
};

export function translateCallFailureText(text: string, locale: string): string | undefined {
  const index = (CALL_FAILURE_LANGUAGES as readonly string[]).indexOf(locale);
  if (index < 0 || !Object.prototype.hasOwnProperty.call(CALL_FAILURE_MESSAGES, text)) return undefined;
  return CALL_FAILURE_MESSAGES[text]?.[index];
}
