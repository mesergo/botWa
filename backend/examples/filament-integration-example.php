<?php

/**
 * דוגמה לשליחת הודעות חיצוניות לסימולטור מ-PHP/Filament
 * 
 * התקנה:
 * - ודא ש-cURL מותקן ומופעל ב-PHP
 * - או השתמש ב-Guzzle HTTP client
 */

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BotMessageService
{
    /**
     * כתובת ה-API של הבוט
     */
    private string $apiBaseUrl;

    /**
     * @param string|null $apiBaseUrl כתובת ה-API (ברירת מחדל: localhost)
     */
    public function __construct(?string $apiBaseUrl = null)
    {
        $this->apiBaseUrl = $apiBaseUrl ?? config('bot.api_url', 'http://localhost:3001/api');
    }

    /**
     * שליחת הודעה לסשן פעיל
     * 
     * @param string $sessionId מזהה הסשן
     * @param array $message אובייקט ההודעה
     * @return array
     * @throws \Exception
     */
    public function sendMessage(string $sessionId, array $message): array
    {
        try {
            $response = Http::post("{$this->apiBaseUrl}/sessions/send-message", [
                'sessionId' => $sessionId,
                'message' => $message
            ]);

            if (!$response->successful()) {
                throw new \Exception(
                    $response->json('error') ?? 'Failed to send message'
                );
            }

            return $response->json();
        } catch (\Exception $e) {
            Log::error('[BotMessageService] Error sending message', [
                'error' => $e->getMessage(),
                'sessionId' => $sessionId
            ]);
            throw $e;
        }
    }

    /**
     * שליחת הודעת טקסט פשוטה
     */
    public function sendTextMessage(string $sessionId, string $text): array
    {
        return $this->sendMessage($sessionId, [
            'content' => $text,
            'type' => 'Text',
            'sender' => 'bot'
        ]);
    }

    /**
     * שליחת תמונה
     */
    public function sendImageMessage(string $sessionId, string $imageUrl, string $caption = ''): array
    {
        return $this->sendMessage($sessionId, [
            'content' => $caption,
            'type' => 'Image',
            'sender' => 'bot',
            'url' => $imageUrl
        ]);
    }

    /**
     * שליחת סרטון
     */
    public function sendVideoMessage(string $sessionId, string $videoUrl, string $caption = ''): array
    {
        return $this->sendMessage($sessionId, [
            'content' => $caption,
            'type' => 'Video',
            'sender' => 'bot',
            'url' => $videoUrl
        ]);
    }

    /**
     * שליחת מסמך
     */
    public function sendDocumentMessage(string $sessionId, string $documentUrl, string $caption = ''): array
    {
        return $this->sendMessage($sessionId, [
            'content' => $caption,
            'type' => 'Document',
            'sender' => 'bot',
            'url' => $documentUrl
        ]);
    }

    /**
     * שליחת תפריט אפשרויות
     */
    public function sendMenuMessage(string $sessionId, string $text, array $options): array
    {
        return $this->sendMessage($sessionId, [
            'content' => $text,
            'type' => 'Options',
            'sender' => 'bot',
            'options' => $options
        ]);
    }

    /**
     * שליחת קישור
     */
    public function sendLinkMessage(string $sessionId, string $text, string $url): array
    {
        return $this->sendMessage($sessionId, [
            'content' => $text,
            'type' => 'URL',
            'sender' => 'bot',
            'url' => $url
        ]);
    }

    /**
     * שליחת תשובה מ-Web Service (גרסה פשוטה)
     */
    public function sendWebServiceResponse(string $sessionId, $data, bool $success = true): array
    {
        if ($success) {
            return $this->sendTextMessage(
                $sessionId,
                "✅ התקבלה תשובה מהשרת:\n" . $this->formatData($data)
            );
        } else {
            return $this->sendTextMessage(
                $sessionId,
                "❌ אירעה שגיאה בעיבוד הבקשה"
            );
        }
    }

    /**
     * עיבוד תשובת Web Service ושליחת המשך התסריט (גרסה מתקדמת)
     * ממירה תגובה מ-web service לפורמט WhatsApp ושולחת את כל ההודעות בסדר
     * 
     * @param string $sessionId - מזהה הסשן
     * @param array $actions - רשימת פעולות לביצוע
     * @param string|null $simulatorId - (אופציונלי) מזהה סימולטור ספציפי
     * @return array
     * 
     * דוגמה לשימוש:
     * $actions = [
     *     ['type' => 'SendMessage', 'text' => 'ההזמנה התקבלה בהצלחה!'],
     *     ['type' => 'SendImage', 'url' => 'https://example.com/receipt.jpg'],
     *     ['type' => 'InputText', 'text' => 'האם תרצה להוסיף עוד משהו?', 'options' => ['כן', 'לא']],
     *     ['type' => 'SetParameter', 'name' => 'orderStatus', 'value' => 'confirmed']
     * ];
     * $this->processWebServiceResponse($sessionId, $actions);
     */
    public function processWebServiceResponse(string $sessionId, array $actions, ?string $simulatorId = null): array
    {
        try {
            $processedCount = 0;
            
            foreach ($actions as $action) {
                $actionType = $action['type'] ?? '';
                Log::info('[processWebServiceResponse] Processing action', ['type' => $actionType]);

                switch ($actionType) {
                    case 'SendMessage':
                        // שליחת הודעת טקסט
                        if (!empty($action['text'])) {
                            $this->sendTextMessage($sessionId, $action['text']);
                            usleep(300000); // המתנה של 300ms בין הודעות
                        }
                        break;

                    case 'SendImage':
                        // שליחת תמונה
                        if (!empty($action['url'])) {
                            $this->sendImageMessage($sessionId, $action['url'], $action['text'] ?? '');
                            usleep(300000);
                        }
                        break;

                    case 'SendVideo':
                        // שליחת סרטון
                        if (!empty($action['url'])) {
                            $this->sendVideoMessage($sessionId, $action['url'], $action['text'] ?? '');
                            usleep(300000);
                        }
                        break;

                    case 'SendDocument':
                        // שליחת מסמך
                        if (!empty($action['url'])) {
                            $this->sendDocumentMessage($sessionId, $action['url'], $action['text'] ?? '');
                            usleep(300000);
                        }
                        break;

                    case 'SendWebpage':
                        // שליחת קישור
                        if (!empty($action['url'])) {
                            $this->sendLinkMessage($sessionId, $action['text'] ?? 'לחץ כאן', $action['url']);
                            usleep(300000);
                        }
                        break;

                    case 'InputText':
                        // שליחת תפריט או בקשת קלט
                        if (!empty($action['options']) && is_array($action['options'])) {
                            // שלח את הטקסט (אם יש) ואז את התפריט
                            if (!empty($action['text'])) {
                                $this->sendTextMessage($sessionId, $action['text']);
                                usleep(200000);
                            }
                            $this->sendMenuMessage($sessionId, '', $action['options']);
                        } elseif (!empty($action['text'])) {
                            // אין אפשרויות - רק טקסט
                            $this->sendTextMessage($sessionId, $action['text']);
                        }
                        break;

                    case 'SetParameter':
                        // הגדרת פרמטר (נשמר ב-session)
                        Log::info('[processWebServiceResponse] SetParameter', [
                            'name' => $action['name'] ?? '',
                            'value' => $action['value'] ?? ''
                        ]);
                        // ניתן להוסיף שמירה של הפרמטר באמצעות API נוסף אם נדרש
                        break;

                    case 'Return':
                        // ערך חזרה (בדרך כלל משמש להחלטות בתוך הבוט)
                        Log::info('[processWebServiceResponse] Return value', ['value' => $action['value'] ?? null]);
                        break;

                    case 'ChangeState':
                        // שינוי מצב הבוט
                        Log::info('[processWebServiceResponse] ChangeState', ['value' => $action['value'] ?? '']);
                        break;

                    default:
                        Log::warning('[processWebServiceResponse] Unknown action type', ['type' => $actionType]);
                }

                $processedCount++;
            }

            Log::info('[processWebServiceResponse] All actions processed successfully', ['count' => $processedCount]);
            return ['success' => true, 'actionsProcessed' => $processedCount];

        } catch (\Exception $e) {
            Log::error('[processWebServiceResponse] Error', ['error' => $e->getMessage()]);
            
            // שליחת הודעת שגיאה לסימולטור
            try {
                $this->sendTextMessage($sessionId, '❌ אירעה שגיאה בעיבוד התשובה מהשרת');
            } catch (\Exception $sendError) {
                Log::error('[processWebServiceResponse] Failed to send error message', ['error' => $sendError->getMessage()]);
            }
            
            throw $e;
        }
    }

    /**
     * עיצוב נתונים להצגה
     */
    private function formatData($data): string
    {
        if (is_array($data)) {
            return json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
        return (string) $data;
    }

    /**
     * שליחת עדכוני סטטוס לתהליך ארוך
     */
    public function sendProgressUpdates(string $sessionId, array $steps, callable $processCallback): array
    {
        $results = [];
        
        foreach ($steps as $index => $step) {
            try {
                // שליחת הודעת התקדמות
                $this->sendTextMessage(
                    $sessionId,
                    "⏳ {$step['message']}"
                );

                // ביצוע הפעולה
                $result = $processCallback($step, $index);
                $results[] = $result;

                // המתנה קצרה
                usleep(500000); // 0.5 שניות

            } catch (\Exception $e) {
                $this->sendTextMessage(
                    $sessionId,
                    "❌ שגיאה בשלב: {$step['message']}"
                );
                throw $e;
            }
        }

        // שליחת הודעת סיום
        $this->sendTextMessage($sessionId, "✅ התהליך הושלם בהצלחה!");
        
        return $results;
    }
}

// ============================================
// דוגמאות שימוש
// ============================================

/**
 * דוגמה 1: שימוש בסיסי
 */
function example1_basicUsage()
{
    $botService = new BotMessageService();
    $sessionId = '67890abcdef12345'; // מזהה סשן אמיתי

    // שליחת הודעת טקסט
    $botService->sendTextMessage($sessionId, 'שלום! זו הודעה מהשרת');

    // שליחת תמונה
    $botService->sendImageMessage(
        $sessionId,
        'https://example.com/image.jpg',
        'הנה התמונה שביקשת'
    );

    // שליחת תפריט
    $botService->sendMenuMessage(
        $sessionId,
        'בחר אפשרות:',
        ['אפשרות 1', 'אפשרות 2', 'אפשרות 3']
    );
}

/**
 * דוגמה 1.5: עיבוד תשובת Web Service עם המשך תסריט (גרסה מתקדמת!)
 */
function example1_5_advancedWebServiceResponse()
{
    $botService = new BotMessageService();
    $sessionId = '67890abcdef12345'; // מזהה סשן אמיתי

    // סימולציה של תגובה מ-web service
    $webServiceResponse = [
        ['type' => 'SendMessage', 'text' => '⏳ מעבד את הבקשה...'],
        ['type' => 'SetParameter', 'name' => 'requestStatus', 'value' => 'processing'],
        ['type' => 'SendMessage', 'text' => '✅ הבקשה עובדה בהצלחה!'],
        ['type' => 'SendMessage', 'text' => 'הנה הפרטים:'],
        ['type' => 'SendImage', 'url' => 'https://example.com/result.jpg', 'text' => 'תוצאת העיבוד'],
        ['type' => 'InputText', 'text' => 'מה תרצה לעשות כעת?', 'options' => ['בקשה חדשה', 'צפייה בהיסטוריה', 'יציאה']]
    ];

    // עיבוד ושליחת כל ההודעות בפורמט WhatsApp
    $botService->processWebServiceResponse($sessionId, $webServiceResponse);
}
        'https://example.com/image.jpg',
        'הנה התמונה שביקשת'
    );

    // שליחת תפריט
    $botService->sendMenuMessage(
        $sessionId,
        'בחר אפשרות:',
        ['אפשרות 1', 'אפשרות 2', 'אפשרות 3']
    );
}

/**
 * דוגמה 2: שילוב עם Filament Form
 */
class OrderResource extends Resource
{
    public static function table(Table $table): Table
    {
        return $table
            ->actions([
                Action::make('notifyCustomer')
                    ->label('שלח עדכון ללקוח')
                    ->icon('heroicon-o-chat-bubble-left-right')
                    ->action(function (Order $record) {
                        $botService = app(BotMessageService::class);
                        
                        // קבל את session ID של הלקוח (שמור בטבלת orders)
                        $sessionId = $record->bot_session_id;
                        
                        if ($sessionId) {
                            $botService->sendTextMessage(
                                $sessionId,
                                "📦 ההזמנה שלך #{$record->id} עודכנה!\n" .
                                "סטטוס: {$record->status}\n" .
                                "מעקב: {$record->tracking_number}"
                            );
                            
                            Notification::make()
                                ->title('העדכון נשלח ללקוח')
                                ->success()
                                ->send();
                        }
                    }),
            ]);
    }
}

/**
 * דוגמה 3: עיבוד טופס עם עדכוני התקדמות
 */
class ProcessFormAction
{
    public function handle($formData, $sessionId)
    {
        $botService = new BotMessageService();

        try {
            // שלב 1: בדיקת נתונים
            $botService->sendTextMessage($sessionId, '⏳ בודק את הנתונים...');
            $this->validateData($formData);

            // שלב 2: שמירה
            $botService->sendTextMessage($sessionId, '💾 שומר במסד הנתונים...');
            $record = $this->saveToDatabase($formData);

            // שלב 3: שליחת מייל
            $botService->sendTextMessage($sessionId, '📧 שולח אימייל...');
            $this->sendEmail($record);

            // הצלחה!
            $botService->sendTextMessage($sessionId, '✅ הטופס עובד בהצלחה!');
            
            // שליחת אפשרויות המשך
            $botService->sendMenuMessage(
                $sessionId,
                'מה תרצה לעשות כעת?',
                ['שלח טופס נוסף', 'צפה בטפסים', 'חזור לתפריט']
            );

        } catch (\Exception $e) {
            $botService->sendTextMessage($sessionId, "❌ שגיאה: {$e->getMessage()}");
            throw $e;
        }
    }

    private function validateData($data) { /* ... */ }
    private function saveToDatabase($data) { /* ... */ return new \stdClass; }
    private function sendEmail($record) { /* ... */ }
}

/**
 * דוגמה 3.5: עיבוד טופס עם processWebServiceResponse (גרסה מתקדמת!)
 */
class AdvancedProcessFormAction
{
    public function handle($formData, $sessionId)
    {
        $botService = new BotMessageService();

        try {
            // בניית רצף פעולות (actions) לפי תגובת web service
            $actions = [
                ['type' => 'SendMessage', 'text' => '⏳ בודק את הנתונים...'],
            ];

            // בדיקת נתונים
            $validationResult = $this->validateData($formData);
            if (!$validationResult['valid']) {
                $actions[] = ['type' => 'SendMessage', 'text' => '❌ שגיאה: ' . $validationResult['error']];
                $actions[] = ['type' => 'InputText', 'text' => 'האם תרצה לנסות שוב?', 'options' => ['כן', 'לא']];
                
                $botService->processWebServiceResponse($sessionId, $actions);
                return;
            }

            // שמירה
            $actions[] = ['type' => 'SendMessage', 'text' => '💾 שומר במסד הנתונים...'];
            $actions[] = ['type' => 'SetParameter', 'name' => 'formId', 'value' => $validationResult['id']];
            
            $record = $this->saveToDatabase($formData);
            
            // שליחת מייל
            $actions[] = ['type' => 'SendMessage', 'text' => '📧 שולח אימייל אישור...'];
            $this->sendEmail($record);

            // הצלחה עם קישור למסמך
            $actions[] = ['type' => 'SendMessage', 'text' => '✅ הטופס נשמר בהצלחה!'];
            $actions[] = ['type' => 'SendMessage', 'text' => 'מספר אסמכתא: #' . $record->id];
            
            // שליחת מסמך PDF
            if ($record->pdf_url) {
                $actions[] = ['type' => 'SendDocument', 'url' => $record->pdf_url, 'text' => 'קובץ PDF של הטופס'];
            }
            
            // תפריט המשך
            $actions[] = ['type' => 'InputText', 'text' => 'מה תרצה לעשות כעת?', 'options' => [
                'שלח טופס נוסף',
                'צפה בטפסים שנשלחו', 
                'הורד דוח',
                'חזור לתפריט ראשי'
            ]];

            // שליחת כל הרצף בבת אחת!
            $botService->processWebServiceResponse($sessionId, $actions);

        } catch (\Exception $e) {
            Log::error('Form processing error', ['error' => $e->getMessage()]);
            
            $errorActions = [
                ['type' => 'SendMessage', 'text' => '❌ אירעה שגיאה בעיבוד הטופס'],
                ['type' => 'SendMessage', 'text' => 'פרטי השגיאה: ' . $e->getMessage()],
                ['type' => 'InputText', 'text' => 'האם תרצה לנסות שוב?', 'options' => ['כן, נסה שוב', 'לא, חזור לתפריט']]
            ];
            
            $botService->processWebServiceResponse($sessionId, $errorActions);
            throw $e;
        }
    }

    private function validateData($data) 
    { 
        // דוגמה
        return ['valid' => true, 'id' => rand(1000, 9999)];
    }
    
    private function saveToDatabase($data) 
    { 
        $record = new \stdClass;
        $record->id = rand(10000, 99999);
        $record->pdf_url = 'https://example.com/forms/form-' . $record->id . '.pdf';
        return $record;
    }
    
    private function sendEmail($record) { /* ... */ }
}

/**
 * דוגמה 4: Webhook Handler
 */
class BotWebhookController extends Controller
{
    public function handlePaymentComplete(Request $request)
    {
        $botService = app(BotMessageService::class);
        
        $sessionId = $request->input('session_id');
        $amount = $request->input('amount');
        $transactionId = $request->input('transaction_id');

        try {
            $botService->sendTextMessage(
                $sessionId,
                "✅ התשלום בסך {$amount}₪ אושר בהצלחה!\n" .
                "מספר עסקה: {$transactionId}"
            );

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('Webhook error', ['error' => $e->getMessage()]);
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}

/**
 * דוגמה 5: שימוש עם Observer (Laravel Events)
 */
class OrderObserver
{
    protected BotMessageService $botService;

    public function __construct(BotMessageService $botService)
    {
        $this->botService = $botService;
    }

    public function updated(Order $order)
    {
        if ($order->isDirty('status') && $order->bot_session_id) {
            $this->notifyCustomer($order);
        }
    }

    private function notifyCustomer(Order $order)
    {
        $statusMessages = [
            'processing' => '⏳ ההזמנה שלך בעיבוד',
            'shipped' => '📦 ההזמנה נשלחה!',
            'delivered' => '✅ ההזמנה נמסרה בהצלחה',
            'cancelled' => '❌ ההזמנה בוטלה',
        ];

        $message = $statusMessages[$order->status] ?? 'עדכון סטטוס להזמנה';

        $this->botService->sendTextMessage($order->bot_session_id, $message);

        if ($order->status === 'shipped' && $order->tracking_url) {
            $this->botService->sendLinkMessage(
                $order->bot_session_id,
                'לחץ כאן למעקב אחר המשלוח',
                $order->tracking_url
            );
        }
    }
}

/**
 * דוגמה 6: קונפיגורציה (config/bot.php)
 */
return [
    'api_url' => env('BOT_API_URL', 'http://localhost:3001/api'),
    
    // הגדרות נוספות
    'timeout' => env('BOT_API_TIMEOUT', 30),
    'retry_times' => env('BOT_API_RETRY', 3),
];

/**
 * דוגמה 7: Service Provider (app/Providers/BotServiceProvider.php)
 */
use Illuminate\Support\ServiceProvider;

class BotServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->app->singleton(BotMessageService::class, function ($app) {
            return new BotMessageService(config('bot.api_url'));
        });
    }

    public function boot()
    {
        // רישום Observer
        Order::observe(OrderObserver::class);
    }
}

/**
 * דוגמה 8: שימוש בגרסה ללא Laravel (PHP טהור)
 */
function sendMessageWithCurl($sessionId, $message)
{
    $apiUrl = 'http://localhost:3001/api/sessions/send-message';
    
    $data = json_encode([
        'sessionId' => $sessionId,
        'message' => $message
    ]);

    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($data)
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Failed to send message: HTTP $httpCode");
    }

    return json_decode($response, true);
}

// שימוש:
// sendMessageWithCurl('67890abcdef12345', [
//     'content' => 'הודעה מ-PHP',
//     'type' => 'Text',
//     'sender' => 'bot'
// ]);
