import SwiftUI
import WidgetKit

// The app group shared with the main app. lib/widget.js writes an array of
// { date: "yyyy-MM-dd", text, author, ref, shortText, shortAuthor, tinyText,
// tinyAuthor } under QUOTES_KEY. The short and tiny passages are for the lock
// screen, which is too small for a long passage and must never cut one off.
private let APP_GROUP = "group.com.harvana.marcus"
private let QUOTES_KEY = "widgetQuotes"

struct QuoteEntry: TimelineEntry {
  let date: Date
  let text: String
  let author: String
  let ref: String
  var shortText: String? = nil
  var shortAuthor: String? = nil
  var tinyText: String? = nil
  var tinyAuthor: String? = nil

  func at(_ d: Date) -> QuoteEntry {
    QuoteEntry(date: d, text: text, author: author, ref: ref, shortText: shortText,
               shortAuthor: shortAuthor, tinyText: tinyText, tinyAuthor: tinyAuthor)
  }
}

// Shown before the app has ever run, and in the widget gallery. A real,
// cited line, because a placeholder quote is still a quote.
private let fallback = QuoteEntry(
  date: Date(),
  text: "First, say to yourself what you would be; and then do what you have to do.",
  author: "Epictetus",
  ref: "Discourses III.23",
  tinyText: "Confine thyself to the present.",
  tinyAuthor: "Marcus Aurelius"
)

private func dayKey(_ d: Date) -> String {
  let f = DateFormatter()
  f.calendar = Calendar(identifier: .gregorian)
  f.locale = Locale(identifier: "en_US_POSIX")
  f.timeZone = .current
  f.dateFormat = "yyyy-MM-dd"
  return f.string(from: d)
}

private func storedQuotes() -> [String: QuoteEntry] {
  // ExtensionStorage stores arrays as JSON bytes, not as a plist array.
  guard let data = UserDefaults(suiteName: APP_GROUP)?.data(forKey: QUOTES_KEY),
        let raw = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] else { return [:] }
  var out: [String: QuoteEntry] = [:]
  for item in raw {
    guard let day = item["date"] as? String, let text = item["text"] as? String,
          let author = item["author"] as? String else { continue }
    out[day] = QuoteEntry(date: Date(), text: text, author: author, ref: (item["ref"] as? String) ?? "",
                          shortText: item["shortText"] as? String, shortAuthor: item["shortAuthor"] as? String,
                          tinyText: item["tinyText"] as? String, tinyAuthor: item["tinyAuthor"] as? String)
  }
  return out
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> QuoteEntry { fallback }

  func getSnapshot(in context: Context, completion: @escaping (QuoteEntry) -> Void) {
    let q = storedQuotes()[dayKey(Date())] ?? fallback
    completion(q.at(Date()))
  }

  // One entry per day, switching at local midnight, for as many days as the
  // app has written. If the app has not been opened for a while, the last
  // stored quote stays up rather than falling back mid-stream.
  func getTimeline(in context: Context, completion: @escaping (Timeline<QuoteEntry>) -> Void) {
    let quotes = storedQuotes()
    let cal = Calendar.current
    let start = cal.startOfDay(for: Date())
    var entries: [QuoteEntry] = []
    var last = quotes[dayKey(start)] ?? fallback
    for i in 0..<14 {
      guard let day = cal.date(byAdding: .day, value: i, to: start) else { continue }
      if let q = quotes[dayKey(day)] { last = q }
      entries.append(last.at(i == 0 ? Date() : day))
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

struct MarcusWidgetView: View {
  @Environment(\.widgetFamily) var family
  var entry: QuoteEntry

  var attribution: String {
    entry.ref.isEmpty ? entry.author.uppercased() : "\(entry.author) · \(entry.ref)".uppercased()
  }

  var body: some View {
    switch family {
    case .accessoryRectangular:
      // Never the long passage: a short one that fits whole.
      let text = entry.shortText ?? entry.text
      VStack(alignment: .leading, spacing: 2) {
        Text("\u{201C}\(text)\u{201D}")
          .font(.system(size: 14, design: .serif))
          .lineLimit(4)
          .minimumScaleFactor(0.7)
        Text((entry.shortAuthor ?? entry.author).uppercased())
          .font(.system(size: 9, weight: .semibold))
          .opacity(0.75)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .containerBackground(for: .widget) { Color.clear }
    case .accessoryInline:
      // One line: the attribution comes along when it fits.
      let tiny = "\u{201C}\(entry.tinyText ?? "Confine thyself to the present.")\u{201D}"
      ViewThatFits {
        Text(tiny + " \u{2014} " + (entry.tinyAuthor ?? "Marcus Aurelius"))
        Text(tiny)
      }
      .containerBackground(for: .widget) { Color.clear }
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        Image("skull").resizable().scaledToFit().padding(9)
          .widgetAccentable()
      }
      .containerBackground(for: .widget) { Color.clear }
    default:
      VStack(alignment: family == .systemSmall ? .leading : .center, spacing: family == .systemSmall ? 6 : (family == .systemLarge ? 18 : 10)) {
        if family != .systemSmall {
          Image("skull").resizable().scaledToFit().frame(height: family == .systemLarge ? 40 : 26)
        }
        Text("\u{201C}\(entry.text)\u{201D}")
          .font(.system(size: family == .systemSmall ? 14 : (family == .systemMedium ? 17 : 24), design: .serif))
          .italic()
          .foregroundColor(Color("cream"))
          .multilineTextAlignment(family == .systemSmall ? .leading : .center)
          // No line limit: a long passage shrinks to fit rather than being cut
          // off mid-sentence, which would misquote it.
          .minimumScaleFactor(0.5)
          .layoutPriority(1)
        Text(attribution)
          .font(.system(size: family == .systemLarge ? 11 : 9, weight: .semibold))
          .tracking(1.2)
          .foregroundColor(Color("gold"))
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: family == .systemSmall ? .topLeading : .center)
      .containerBackground(for: .widget) { Color("background") }
    }
  }
}

@main
struct MarcusWidget: Widget {
  let kind = "MarcusWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      MarcusWidgetView(entry: entry).widgetURL(URL(string: "marcus://"))
    }
    .configurationDisplayName("Today's passage")
    .description("The day's quote from Marcus, with its source.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline, .accessoryCircular])
  }
}
